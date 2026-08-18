import type { RequestInit } from "next/dist/server/web/spec-extension/request";

export const BACKEND_BASE_URL =
  process.env.BACKEND_BASE_URL || "http://127.0.0.1:8080/backend";

/** Per-request timeout for backend calls. A hung backend should not tie up the
 * BFF (DoS surface). Tunable via env for unusual environments. */
const BACKEND_TIMEOUT_MS = Number(process.env.BACKEND_TIMEOUT_MS) || 15_000;

/**
 * BFF→backend 内部共享密钥（X-Internal-Auth 头）。
 * 配置后所有后端请求统一注入（以 BFF 配置为准，覆盖调用方传参），
 * 防止客户端伪造的同名头透传到 Java 后端。
 * 未配置时 fail-open（仅限本地 dev）并 WARN 一次，且剥离调用方传入的同名头。
 */
const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || "";
let internalAuthWarned = false;

function internalAuthHeader(): Record<string, string> {
  if (INTERNAL_AUTH_SECRET) {
    return { "X-Internal-Auth": INTERNAL_AUTH_SECRET };
  }
  if (!internalAuthWarned) {
    internalAuthWarned = true;
    console.warn(
      "[backendClient] INTERNAL_AUTH_SECRET 未配置，BFF→backend 请求未携带 X-Internal-Auth（fail-open，仅限本地 dev；生产请在 compose 注入）"
    );
  }
  return {};
}

export interface BackendError {
  code: string;
  message: string;
  details?: unknown;
}

export class BackendHttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * 受管后端请求（非 JSON 响应专用）：与 callBackend 同样的
 * 头注入（Content-Type/X-Internal-Auth 剥离伪造）+ 超时（MID-3）+ 错误映射
 * （!ok → BackendHttpError），但返回原始 Response 由调用方自行解析
 * （如 leads/export 的 CSV 流，不能走 JSON 解析）。
 */
export async function callBackendRaw(
  path: string,
  init: RequestInit & { headers?: HeadersInit } = {}
): Promise<Response> {
  const url = `${BACKEND_BASE_URL}${path}`;

  // 调用方 headers 副本：剥离可伪造的 X-Internal-Auth（未配置密钥时也不透传）
  const callerHeaders = {
    ...((init.headers as Record<string, string>) || {}),
  };
  delete callerHeaders["X-Internal-Auth"];
  delete callerHeaders["x-internal-auth"];

  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...callerHeaders,
      // X-Internal-Auth 最后合并：以 env 密钥为准（覆盖任何调用方传参）
      ...internalAuthHeader(),
    },
    // MID-3: cap backend latency so a hung backend can't lock up the BFF. Callers
    // can pass their own signal to override per-route; absent that we apply a
    // default deadline.
    signal: init.signal ?? AbortSignal.timeout(BACKEND_TIMEOUT_MS),
  });

  if (!res.ok) {
    let errBody: BackendError | undefined;
    try {
      errBody = (await res.json()) as BackendError;
    } catch {
      // ignore
    }
    const code = errBody?.code || "INTERNAL";
    const msg = errBody?.message || `Backend error ${res.status}`;
    throw new BackendHttpError(res.status, code, msg, errBody?.details);
  }

  return res;
}

export async function callBackend<T>(
  path: string,
  init: RequestInit & { headers?: HeadersInit } = {}
): Promise<T> {
  const res = await callBackendRaw(path, init);

  // 204 No Content -> return undefined (DELETE, PATCH revoke, etc.)
  if (res.status === 204) {
    return undefined as T;
  }

  // 对于 settings 之类直接透传 JSON 的接口，可能是 text
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  const text = await res.text();
  return JSON.parse(text) as T;
}


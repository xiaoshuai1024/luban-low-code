import type { RequestInit } from "next/dist/server/web/spec-extension/request";

export const BACKEND_BASE_URL =
  process.env.BACKEND_BASE_URL || "http://127.0.0.1:8080/backend";

/** Per-request timeout for backend calls. A hung backend should not tie up the
 * BFF (DoS surface). Tunable via env for unusual environments. */
const BACKEND_TIMEOUT_MS = Number(process.env.BACKEND_TIMEOUT_MS) || 15_000;

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

export async function callBackend<T>(
  path: string,
  init: RequestInit & { headers?: HeadersInit } = {}
): Promise<T> {
  const url = `${BACKEND_BASE_URL}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
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

  // 对于 settings 之类直接透传 JSON 的接口，可能是 text
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  const text = await res.text();
  return JSON.parse(text) as T;
}


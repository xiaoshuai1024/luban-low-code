import { NextResponse } from "next/server";

/**
 * aiClient.ts — AI 服务（packages/ai-assistant，FastAPI，路由前缀 /ai）反代客户端。
 *
 * 信任架构（对齐 ai-assistant app/auth/bff_user.py 的 M3 设计）：
 *   前端 → BFF（校验 luban JWT）→ AI 服务（BFF 附加服务间信任头）：
 *   - X-Internal-Token：BFF 与 AI 服务共享密钥（env AI_SERVICE_TOKEN）
 *   - X-User-Id / X-User-Role：BFF 从 JWT 透传（AI 服务不再持有 JWT secret）
 *   - X-Luban-Role：同 X-User-Role 的角色判定（design D4 命名），便于链路观测
 *
 * SSRF 防护（复用 /api/proxy/fetch + ssrfGuard 的思路，但目标集合不同）：
 *   ssrfGuard 面向【用户任意 URL】（https-only + 禁私网 IP + 端口白名单）；
 *   本客户端面向【env 固定配置的内部服务】（compose 内 http://ai:8000），
 *   不适用 https-only/禁私网规则（会把内部目标全部拦掉）。防护改为：
 *   1. 目标 origin 只来自 env AI_SERVICE_BASE_URL（服务端配置，非用户输入），
 *      且经过协议/userinfo 校验，非法一律视为未配置（503，不静默）；
 *   2. 请求路径是调用方写死的常量（/ai/config、/ai/chat）——目标 URL 无任何
 *      用户可控片段，构造上不可能被引导到配置目标之外的主机；
 *   3. 出站 headers 由本客户端全部重建（绝不复制客户端请求头），客户端伪造的
 *      X-Internal-Token / X-User-* / X-Luban-Role 天然到不了上游；
 *   4. redirect: "manual"（同 proxy 路由 BLOCK-1）：3xx 一律拒绝，防重定向绕过。
 *
 * 超时：AbortSignal.timeout（对齐 backendClient MID-3）。config 等常规请求 15s；
 * /ai/chat 为 SSE 长流，默认 120s（流被截断即断流，由客户端重试）。
 */

/** BFF 视角的角色：admin=管理员，user=登录运营者，visitor=C 端未登录访客。 */
export type LubanAiRole = "admin" | "user" | "visitor";

export const AI_SERVICE_UNAVAILABLE = "AI_SERVICE_UNAVAILABLE";
export const AI_UPSTREAM_UNAVAILABLE = "AI_UPSTREAM_UNAVAILABLE";
export const AI_UPSTREAM_TIMEOUT = "AI_UPSTREAM_TIMEOUT";

/** 常规（非流式）AI 请求超时，对齐 backendClient 默认值。 */
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 15_000;
/** SSE 流式请求整体超时上限（含流消费期间）。 */
const AI_STREAM_TIMEOUT_MS =
  Number(process.env.AI_STREAM_TIMEOUT_MS) || 120_000;

/**
 * AI 服务基址（服务根，不含 /ai 路由前缀；如 http://ai:8000）。
 * 惰性读 env：未配置/非法 → null（调用方返 503 AI_SERVICE_UNAVAILABLE）。
 */
export function aiServiceBaseUrl(): URL | null {
  const raw = (process.env.AI_SERVICE_BASE_URL || "").trim();
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;
  return parsed;
}

/**
 * BFF→AI 服务间密钥（X-Internal-Token，与 ai-assistant 的 AI_SERVICE_TOKEN 同值）。
 * 未配置时 fail-open（仅限本地 dev）并 WARN 一次；AI 服务侧此时走 JWT 自验降级。
 */
let internalTokenWarned = false;
function internalTokenHeader(): Record<string, string> {
  const token = process.env.AI_SERVICE_TOKEN || "";
  if (token) return { "X-Internal-Token": token };
  if (!internalTokenWarned) {
    internalTokenWarned = true;
    console.warn(
      "[aiClient] AI_SERVICE_TOKEN 未配置，BFF→AI 请求未携带 X-Internal-Token（fail-open，仅限本地 dev；生产请在 compose 注入）"
    );
  }
  return {};
}

/**
 * 角色判定（design D4）：无 token 或 token 无管理身份 → visitor（C 端访客，
 * 禁工具调用）；admin 透传；其余登录角色归一为 user。
 */
export function roleFromPayload(payload: { role?: string } | null): LubanAiRole {
  if (!payload) return "visitor";
  const role = (payload.role || "user").toLowerCase();
  if (role === "admin") return "admin";
  if (role === "visitor") return "visitor";
  return "user";
}

/**
 * visitor 角色强制禁用工具调用：转发体覆盖 tools=[]（无论调用方传了什么）。
 * AI 服务侧（ai_deps.build_tool_client）对 visitor 同样返回 None，此处是 BFF
 * 层的第一道强制（纵深防御：客户端声明什么都不能放开工具）。
 */
export function forceVisitorNoTools(
  body: Record<string, unknown>,
  role: LubanAiRole
): Record<string, unknown> {
  if (role !== "visitor") return body;
  return { ...body, tools: [] };
}

export interface AiProxyInit {
  /** AI 服务上的固定路径（服务端常量，如 "/ai/config"）。 */
  path: string;
  method: "GET" | "PUT" | "POST";
  role: LubanAiRole;
  /** BFF 判定后的用户身份（visitor 用固定匿名 id，见 chat 路由）。 */
  userId: string;
  /** 已序列化的 JSON 请求体（可选）。 */
  body?: string;
  /** SSE 流式端点（/ai/chat）：响应体原样透传。 */
  stream?: boolean;
  timeoutMs?: number;
}

/** AI 反代统一错误体：task 契约为 {error}，BFF 既有约定为 {code}，两者同值都给。 */
function aiError(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ error: code, code, message }, { status });
}

/** AbortSignal.timeout 抛 TimeoutError；外部 abort 抛 AbortError。两者都视为超时。 */
function isAbortError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const name = (e as { name?: string }).name;
  return name === "TimeoutError" || name === "AbortError";
}

/**
 * 反代到 AI 服务并返回 NextResponse：
 * - 未配置/非法 AI_SERVICE_BASE_URL → 503 AI_SERVICE_UNAVAILABLE（e2e 契约：不静默）；
 * - 网络层失败（DNS/ECONNREFUSED 等）→ 502 AI_UPSTREAM_UNAVAILABLE；
 * - 超时 → 504 AI_UPSTREAM_TIMEOUT；
 * - 上游 3xx → 502（拒绝跟随重定向）；
 * - 其余（含上游 4xx/5xx）→ 状态码与 body 原样透传（反代语义，不吞错）。
 */
export async function proxyAiService(init: AiProxyInit): Promise<NextResponse> {
  const base = aiServiceBaseUrl();
  if (!base) {
    return aiError(
      AI_SERVICE_UNAVAILABLE,
      "AI service is not configured (set AI_SERVICE_BASE_URL)",
      503
    );
  }

  // SSRF 防护核心：target = 校验过的 env origin + 服务端常量路径，无用户输入。
  const target = new URL(init.path, base);

  // 出站头全部重建：客户端的任何头（含伪造的 X-Internal-Token/X-User-*）不透传。
  const headers: Record<string, string> = {
    Accept: init.stream ? "text/event-stream" : "application/json",
    ...internalTokenHeader(),
    "X-User-Id": init.userId,
    "X-User-Role": init.role,
    "X-Luban-Role": init.role,
  };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: init.method,
      headers,
      body: init.body,
      redirect: "manual",
      signal: AbortSignal.timeout(
        init.timeoutMs ??
          (init.stream ? AI_STREAM_TIMEOUT_MS : AI_TIMEOUT_MS)
      ),
    });
  } catch (e) {
    if (isAbortError(e)) {
      return aiError(AI_UPSTREAM_TIMEOUT, "AI service timed out", 504);
    }
    return aiError(
      AI_UPSTREAM_UNAVAILABLE,
      `AI service unreachable: ${e instanceof Error ? e.message : "network error"}`,
      502
    );
  }

  // BLOCK-1（同 proxy 路由）：不跟随重定向，3xx 一律拒绝。
  if (upstream.status >= 300 && upstream.status < 400) {
    return aiError(
      AI_UPSTREAM_UNAVAILABLE,
      `redirect not allowed (status ${upstream.status})`,
      502
    );
  }

  if (init.stream) {
    // SSE：响应体（含错误流的 body）原样透传，禁缓冲。
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") || "text/event-stream",
        "cache-control": "no-cache",
      },
    });
  }

  const text = await upstream.text();
  let data: unknown = text;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // 保持 text 原样透传
    }
  }
  if (typeof data === "string") {
    return new NextResponse(data, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") || "text/plain; charset=utf-8",
      },
    });
  }
  return NextResponse.json(data, { status: upstream.status });
}

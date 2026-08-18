import { NextResponse } from "next/server";
import { BackendHttpError } from "./backendClient";

/** 将后端/异常转为统一错误响应，透传后端 status/code。 */
export function toBackendResponse(e: unknown): NextResponse {
  if (e instanceof BackendHttpError) {
    return NextResponse.json(
      { code: e.code, message: e.message, details: e.details },
      { status: e.status }
    );
  }
  const msg = e instanceof Error ? e.message : "internal error";
  return NextResponse.json({ code: "INTERNAL", message: msg }, { status: 500 });
}

/** 已鉴权用户的注入 header；未鉴权返回 null。 */
export function authHeaders(
  payload: { sub: string; role: string } | null
): { "X-User-ID": string; "X-User-Role": string } | null {
  if (!payload) return null;
  return { "X-User-ID": payload.sub, "X-User-Role": payload.role || "user" };
}

export function unauthenticated() {
  return NextResponse.json(
    { code: "UNAUTHENTICATED", message: "invalid token" },
    { status: 401 }
  );
}

/** 429 限流响应（登录/注册等接口共享构造器，错误体统一 code 字段）。 */
export function rateLimited() {
  return NextResponse.json(
    { code: "RATE_LIMITED", message: "too many failed attempts, retry later" },
    { status: 429 }
  );
}

/**
 * 客户端可伪造的内部信任头（小写）。
 * X-User-ID/X-User-Role 只能由 BFF 在 JWT 校验后注入（authHeaders），
 * X-Internal-Auth 只能由 backendClient 按 env 密钥注入；
 * 客户端传入的一律在请求入口剥离（见 src/middleware.ts）。
 */
export const UNTRUSTED_INTERNAL_HEADERS = [
  "x-user-id",
  "x-user-role",
  "x-internal-auth",
] as const;

/** 返回剥离内部信任头后的新 Headers（不修改入参）。 */
export function stripUntrustedHeaders(headers: Headers): Headers {
  const cleaned = new Headers(headers);
  for (const h of UNTRUSTED_INTERNAL_HEADERS) {
    cleaned.delete(h);
  }
  return cleaned;
}

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

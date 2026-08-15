import { NextRequest, NextResponse } from "next/server";
import { UNTRUSTED_INTERNAL_HEADERS, stripUntrustedHeaders } from "@/lib/apiHandler";

/**
 * 请求入口安全剥离：X-User-ID / X-User-Role / X-Internal-Auth 只能由 BFF
 * 自身设置（JWT 校验后注入用户身份 / backendClient 注入共享密钥），
 * 客户端传入的同名头在进入任何 API route 之前一律剥离，防止伪造透传到后端。
 */
export function middleware(req: NextRequest) {
  const hasUntrusted = UNTRUSTED_INTERNAL_HEADERS.some((h) =>
    req.headers.has(h)
  );
  if (!hasUntrusted) return NextResponse.next();
  return NextResponse.next({
    request: { headers: stripUntrustedHeaders(req.headers) },
  });
}

export const config = { matcher: "/api/:path*" };

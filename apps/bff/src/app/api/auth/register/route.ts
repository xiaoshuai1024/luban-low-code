import { NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { rateLimited, toBackendResponse } from "@/lib/apiHandler";
import { clientIpFromRequest, isRateLimited, recordFailure } from "@/lib/rateLimit";

interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

interface RegisterResult {
  username: string;
  emailMasked: string;
  /** 仅 MAIL_DEV_ECHO env（dev/e2e）时 Java 会附带，BFF 原样透传 */
  devCode?: string;
}

/** POST /api/auth/register — 透传 Java /auth/register（免鉴权，IP 限流 scope=register，仅失败计窗） */
export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  if (isRateLimited(ip, Date.now(), "register")) return rateLimited();

  try {
    const body = (await req.json().catch(() => null)) as RegisterPayload | null;
    if (body === null) {
      // 客户端坏 JSON：对齐 login，计入限流窗口后直接 400
      recordFailure(ip, Date.now(), "register");
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const result = await callBackend<RegisterResult>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    // 注册失败（后端 409/400/503/5xx）计入限流窗口；
    // 后端坏响应体的 SyntaxError 也会落到这里，经 toBackendResponse 归为 500 INTERNAL
    recordFailure(ip, Date.now(), "register");
    return toBackendResponse(e);
  }
}

import { NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { rateLimited, toBackendResponse } from "@/lib/apiHandler";
import { clientIpFromRequest, isRateLimited, recordFailure } from "@/lib/rateLimit";

interface ResendPayload {
  email: string;
}

interface ResendResult {
  emailMasked: string;
  /** 仅 MAIL_DEV_ECHO env（dev/e2e）时 Java 会附带，BFF 原样透传 */
  devCode?: string;
}

/** POST /api/auth/register/resend — 透传 Java 重发验证码（免鉴权，IP 限流 scope=resend；60s 冷却/日限在 Java） */
export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  if (isRateLimited(ip, Date.now(), "resend")) return rateLimited();

  try {
    const body = (await req.json()) as ResendPayload;

    const result = await callBackend<ResendResult>("/auth/register/resend", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return NextResponse.json(result);
  } catch (e) {
    // 重发失败（冷却/日限/503、body 非法）计入限流窗口
    recordFailure(ip, Date.now(), "resend");
    if (e instanceof SyntaxError) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid JSON body" },
        { status: 400 }
      );
    }
    return toBackendResponse(e);
  }
}

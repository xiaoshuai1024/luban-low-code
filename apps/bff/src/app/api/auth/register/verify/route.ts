import { NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { signToken } from "@/lib/authToken";
import { rateLimited, toBackendResponse } from "@/lib/apiHandler";
import { clientIpFromRequest, isRateLimited, recordFailure } from "@/lib/rateLimit";

interface VerifyPayload {
  email: string;
  code: string;
}

/** Java /auth/register/verify 200 响应（BFF 据此签发 JWT） */
interface VerifyBackendResult {
  user: {
    id: string;
    username: string;
    name?: string;
    role?: string;
    status?: string;
  };
}

interface VerifyResult {
  token: string;
  user: { username: string; name?: string; role?: string };
}

/** POST /api/auth/register/verify — 校验邮箱验证码并在 BFF 组装登录态（engine 零适配，剥离 user.id） */
export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  if (isRateLimited(ip, Date.now(), "verify")) return rateLimited();

  try {
    const body = (await req.json()) as VerifyPayload;

    const backendRes = await callBackend<VerifyBackendResult>(
      "/auth/register/verify",
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );

    const token = signToken({
      id: backendRes.user.id,
      username: backendRes.user.username,
      role: backendRes.user.role,
    });

    const result: VerifyResult = {
      token,
      user: {
        // 安全：不暴露 user.id（内部 UUID）
        username: backendRes.user.username,
        name: backendRes.user.name,
        role: backendRes.user.role,
      },
    };

    return NextResponse.json(result);
  } catch (e) {
    // 验证失败（错码/过期/尝试超限、body 非法）计入限流窗口
    recordFailure(ip, Date.now(), "verify");
    if (e instanceof SyntaxError) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid JSON body" },
        { status: 400 }
      );
    }
    return toBackendResponse(e);
  }
}

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
    const body = (await req.json().catch(() => null)) as VerifyPayload | null;
    if (body === null) {
      // 客户端坏 JSON：对齐 login，计入限流窗口后直接 400
      recordFailure(ip, Date.now(), "verify");
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid JSON body" },
        { status: 400 }
      );
    }

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
    // 验证失败（错码/过期/尝试超限）计入限流窗口；
    // 后端坏响应体的 SyntaxError 也会落到这里，经 toBackendResponse 归为 500 INTERNAL
    recordFailure(ip, Date.now(), "verify");
    return toBackendResponse(e);
  }
}

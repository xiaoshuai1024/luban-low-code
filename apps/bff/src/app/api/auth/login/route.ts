import { NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { signToken } from "@/lib/authToken";
import { toBackendResponse } from "@/lib/apiHandler";
import { clientIpFromRequest, isRateLimited, recordFailure } from "@/lib/rateLimit";

interface LoginPayload {
  username: string;
  password: string;
}

interface LoginResult {
  token: string;
  user?: { username: string; name?: string; role?: string };
}

function rateLimited() {
  return NextResponse.json(
    { error: "RATE_LIMITED", message: "too many failed attempts, retry later" },
    { status: 429 }
  );
}

export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  if (isRateLimited(ip)) return rateLimited();

  try {
    const body = (await req.json()) as LoginPayload;

    // 调用后端校验账号密码
    const backendRes = await callBackend<{
      user: { id: string; username: string; name?: string; role?: string };
      claims: { userId: string; role: string };
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });

    // 基于返回的用户信息在 BFF 层签发 JWT
    const token = signToken({
      id: backendRes.user.id,
      username: backendRes.user.username,
      role: backendRes.user.role,
    });

    const result: LoginResult = {
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
    // 登录失败（后端 401/5xx、body 非法）计入限流窗口
    recordFailure(ip);
    if (e instanceof SyntaxError) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid JSON body" },
        { status: 400 }
      );
    }
    return toBackendResponse(e);
  }
}

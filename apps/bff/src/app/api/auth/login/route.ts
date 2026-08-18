import { NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { signToken } from "@/lib/authToken";
import { rateLimited, toBackendResponse } from "@/lib/apiHandler";
import { clientIpFromRequest, isRateLimited, recordFailure } from "@/lib/rateLimit";

interface LoginPayload {
  username: string;
  password: string;
}

interface LoginResult {
  token: string;
  user?: { username: string; name?: string; role?: string };
}

export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  if (isRateLimited(ip)) return rateLimited();

  try {
    // 前置解析：仅客户端坏 JSON 归 400（计入限流）；外层 catch 只兜后端错误（坏响应 500 不误归因）
    const body = (await req.json().catch(() => null)) as LoginPayload | null;
    if (body === null) {
      recordFailure(ip);
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid JSON body" },
        { status: 400 }
      );
    }

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
    // 登录失败（后端 401/5xx）计入限流窗口
    recordFailure(ip);
    return toBackendResponse(e);
  }
}

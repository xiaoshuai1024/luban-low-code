import { NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { signToken } from "@/lib/authToken";

interface LoginPayload {
  username: string;
  password: string;
}

interface LoginResult {
  token: string;
  user?: { id: string; username: string; name?: string };
}

export async function POST(req: Request) {
  const body = (await req.json()) as LoginPayload;

  // 调用 backend-go 校验账号密码
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
      id: backendRes.user.id,
      username: backendRes.user.username,
      name: backendRes.user.name,
    },
  };

  return NextResponse.json(result);
}



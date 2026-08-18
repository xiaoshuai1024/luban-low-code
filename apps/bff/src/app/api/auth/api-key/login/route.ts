import { NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { signToken } from "@/lib/authToken";
import { rateLimited, toBackendResponse } from "@/lib/apiHandler";
import type { ApiKeyValidateResponse } from "@/lib/apiKey";
import { clientIpFromRequest, isRateLimited, recordFailure } from "@/lib/rateLimit";

interface ApiKeyLoginPayload {
  apiKey: string;
}

interface ApiKeyLoginResult {
  token: string;
  user: { username: string; role?: string };
}

/**
 * POST /api/auth/api-key/login
 *
 * Authenticate via an API key (X-Api-Key forwarded to the backend for
 * validation) and return a JWT + user info.
 */
export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  if (isRateLimited(ip)) return rateLimited();

  try {
    // 前置解析：仅客户端坏 JSON 归 400（计入限流）；外层 catch 只兜后端错误
    const body = (await req.json().catch(() => null)) as ApiKeyLoginPayload | null;
    if (body === null) {
      recordFailure(ip);
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Validate the API key against the backend
    const backendRes = await callBackend<ApiKeyValidateResponse>(
      "/auth/api-key/validate",
      {
        method: "POST",
        headers: { "X-Api-Key": body.apiKey },
      }
    );

    // Sign a BFF‑layer JWT with the user info returned by the backend
    const token = signToken({
      id: backendRes.userId,
      username: backendRes.username,
      role: backendRes.role,
    });

    const result: ApiKeyLoginResult = {
      token,
      user: {
        username: backendRes.username,
        role: backendRes.role,
      },
    };

    return NextResponse.json(result);
  } catch (e) {
    // 校验失败（后端 401/5xx）计入限流窗口
    recordFailure(ip);
    return toBackendResponse(e);
  }
}

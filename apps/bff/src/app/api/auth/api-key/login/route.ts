import { NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { signToken } from "@/lib/authToken";
import { toBackendResponse } from "@/lib/apiHandler";
import type { ApiKeyValidateResponse } from "@/lib/apiKey";
import { clientIpFromRequest, isRateLimited, recordFailure } from "@/lib/rateLimit";

interface ApiKeyLoginPayload {
  apiKey: string;
}

interface ApiKeyLoginResult {
  token: string;
  user: { username: string; role?: string };
}

function rateLimited() {
  return NextResponse.json(
    { error: "RATE_LIMITED", message: "too many failed attempts, retry later" },
    { status: 429 }
  );
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
    const body = (await req.json()) as ApiKeyLoginPayload;

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
    // 校验失败（后端 401/5xx、body 非法）计入限流窗口
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

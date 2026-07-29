import { NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { signToken } from "@/lib/authToken";
import type { ApiKeyValidateResponse } from "@/lib/apiKey";

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
}

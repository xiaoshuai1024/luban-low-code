import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";

export async function GET(req: NextRequest) {
  const payload = parseTokenFromRequest(req);
  if (!payload) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", message: "invalid token" },
      { status: 401 }
    );
  }

  const headers: HeadersInit = {
    "X-User-ID": payload.sub,
    "X-User-Role": payload.role,
  };

  const backendMe = await callBackend<{ id: string; role?: string }>(
    "/auth/me",
    {
      method: "GET",
      headers,
    }
  );

  const me = {
    username: payload.username,
    role: backendMe.role ?? payload.role,
  };

  return NextResponse.json(me);
}



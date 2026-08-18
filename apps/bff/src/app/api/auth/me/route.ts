import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

/** GET /api/auth/me → 当前用户信息（后端错误透传，不再被兜底成 500） */
export async function GET(req: NextRequest) {
  try {
    const payload = parseTokenFromRequest(req);
    const h = authHeaders(payload);
    if (!payload || !h) return unauthenticated();

    const backendMe = await callBackend<{ id: string; role?: string }>(
      "/auth/me",
      {
        method: "GET",
        headers: h,
      }
    );

    const me = {
      username: payload.username,
      role: backendMe.role ?? payload.role,
    };

    return NextResponse.json(me);
  } catch (e) {
    return toBackendResponse(e);
  }
}

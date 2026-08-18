import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

interface User {
  id: string;
  username: string;
  name?: string;
  role?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** PATCH /api/users/:id/status → 启停用户（后端 403/404/409 等错误透传，不再被兜底成 500） */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { id } = await params;
    // 前置解析：仅客户端坏 JSON 归 400；外层 catch 只兜后端错误
    const body = await req.json().catch(() => null);
    if (body === null) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid JSON body" },
        { status: 400 }
      );
    }
    const user = await callBackend<User>(`/users/${id}/status`, {
      method: "PATCH",
      headers: h,
      body: JSON.stringify(body),
    });
    return NextResponse.json(user);
  } catch (e) {
    return toBackendResponse(e);
  }
}

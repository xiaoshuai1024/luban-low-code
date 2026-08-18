import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

/** GET /api/settings → 系统设置（后端 403/404/5xx 透传，不再被兜底成 500） */
export async function GET(req: NextRequest) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const json = await callBackend<unknown>("/settings", {
      method: "GET",
      headers: h,
    });
    return NextResponse.json(json);
  } catch (e) {
    return toBackendResponse(e);
  }
}

/** PUT /api/settings → 更新系统设置 */
export async function PUT(req: NextRequest) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    // 前置解析：仅客户端坏 JSON 归 400；外层 catch 只兜后端错误
    const body = await req.json().catch(() => null);
    if (body === null) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid JSON body" },
        { status: 400 }
      );
    }
    const json = await callBackend<unknown>("/settings", {
      method: "PUT",
      headers: h,
      body: JSON.stringify(body),
    });
    return NextResponse.json(json);
  } catch (e) {
    return toBackendResponse(e);
  }
}

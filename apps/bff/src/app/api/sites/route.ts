import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

interface Site {
  id: string;
  name: string;
  slug?: string;
  baseUrl?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** GET /api/sites → 当前用户站点列表（后端错误透传，不再被兜底成 500） */
export async function GET(req: NextRequest) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const sites = await callBackend<Site[]>("/sites", {
      method: "GET",
      headers: h,
    });
    return NextResponse.json(sites);
  } catch (e) {
    return toBackendResponse(e);
  }
}

/** POST /api/sites → 新建站点（201；409 SLUG_CONFLICT 等透传） */
export async function POST(req: NextRequest) {
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
    const site = await callBackend<Site>("/sites", {
      method: "POST",
      headers: h,
      body: JSON.stringify(body),
    });
    return NextResponse.json(site, { status: 201 });
  } catch (e) {
    return toBackendResponse(e);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import {
  toBackendResponse,
  authHeaders,
  unauthenticated,
} from "@/lib/apiHandler";

interface PageMeta {
  id: string;
  siteId: string;
  name: string;
  path: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { siteId } = await params;
    const list = await callBackend<PageMeta[]>(`/sites/${siteId}/pages`, {
      method: "GET",
      headers: h,
    });
    return NextResponse.json(list);
  } catch (e) {
    // 透传后端错误（403/404/429 QUOTA_EXCEEDED 等），未捕获会变 500
    return toBackendResponse(e);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { siteId } = await params;
    // 前置解析：仅客户端坏 JSON 归 400；外层 catch 只兜后端错误（含 403/404/429 透传）
    const body = await req.json().catch(() => null);
    if (body === null) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid JSON body" },
        { status: 400 }
      );
    }
    const page = await callBackend<PageMeta>(`/sites/${siteId}/pages`, {
      method: "POST",
      headers: h,
      body: JSON.stringify(body),
    });
    return NextResponse.json(page, { status: 201 });
  } catch (e) {
    return toBackendResponse(e);
  }
}

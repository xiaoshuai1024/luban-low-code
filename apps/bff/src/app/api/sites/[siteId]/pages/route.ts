import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse } from "@/lib/apiHandler";

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
    const payload = parseTokenFromRequest(req);
    if (!payload) {
      return NextResponse.json(
        { code: "UNAUTHENTICATED", message: "invalid token" },
        { status: 401 }
      );
    }
    const { siteId } = await params;
    const headers: HeadersInit = {
      "X-User-ID": payload.sub,
      "X-User-Role": payload.role,
    };
    const list = await callBackend<PageMeta[]>(`/sites/${siteId}/pages`, {
      method: "GET",
      headers,
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
    const payload = parseTokenFromRequest(req);
    if (!payload) {
      return NextResponse.json(
        { code: "UNAUTHENTICATED", message: "invalid token" },
        { status: 401 }
      );
    }
    const { siteId } = await params;
    const headers: HeadersInit = {
      "X-User-ID": payload.sub,
      "X-User-Role": payload.role,
    };
    const body = await req.json();
    const page = await callBackend<PageMeta>(`/sites/${siteId}/pages`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    return NextResponse.json(page, { status: 201 });
  } catch (e) {
    // 透传后端错误（403/404/429 QUOTA_EXCEEDED 等），未捕获会变 500
    return toBackendResponse(e);
  }
}

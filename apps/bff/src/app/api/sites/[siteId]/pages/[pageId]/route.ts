import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

interface PageMeta {
  id: string;
  siteId: string;
  name: string;
  path: string;
  status?: string;
  schema?: unknown;
  createdAt?: string;
  updatedAt?: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string; pageId: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { siteId, pageId } = await params;
    const page = await callBackend<PageMeta>(
      `/sites/${siteId}/pages/${pageId}`,
      { method: "GET", headers: h }
    );
    return NextResponse.json(page);
  } catch (e) {
    return toBackendResponse(e);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string; pageId: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { siteId, pageId } = await params;
    const body = await req.json();
    const page = await callBackend<PageMeta>(
      `/sites/${siteId}/pages/${pageId}`,
      { method: "PUT", headers: h, body: JSON.stringify(body) }
    );
    return NextResponse.json(page);
  } catch (e) {
    return toBackendResponse(e);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string; pageId: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { siteId, pageId } = await params;
    await callBackend<unknown>(`/sites/${siteId}/pages/${pageId}`, {
      method: "DELETE",
      headers: h,
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return toBackendResponse(e);
  }
}

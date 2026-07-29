import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

/**
 * V2-T7 Single-collection proxy:
 *   GET    /api/collections/:id?siteId= → 200 | 404
 *   PUT    /api/collections/:id?siteId= → 200 | 404 | 409
 *   DELETE /api/collections/:id?siteId= → 204 | 404
 */
interface Collection {
  id: string;
  siteId: string;
  name: string;
  fieldSchema?: Record<string, unknown>;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { id } = await params;
    const qs = new URL(req.url).searchParams.toString();
    const path = qs ? `/collections/${encodeURIComponent(id)}?${qs}` : `/collections/${encodeURIComponent(id)}`;
    const data = await callBackend<Collection>(path, { method: "GET", headers: h });
    return NextResponse.json(data);
  } catch (e) {
    return toBackendResponse(e);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { id } = await params;
    const qs = new URL(req.url).searchParams.toString();
    const path = qs ? `/collections/${encodeURIComponent(id)}?${qs}` : `/collections/${encodeURIComponent(id)}`;
    const body = await req.json();
    const data = await callBackend<Collection>(path, {
      method: "PUT",
      headers: h,
      body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (e) {
    return toBackendResponse(e);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { id } = await params;
    const qs = new URL(req.url).searchParams.toString();
    const path = qs ? `/collections/${encodeURIComponent(id)}?${qs}` : `/collections/${encodeURIComponent(id)}`;
    await callBackend<Collection>(path, { method: "DELETE", headers: h });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return toBackendResponse(e);
  }
}

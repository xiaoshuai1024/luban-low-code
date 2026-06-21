import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

/**
 * V2-T7 Single collection item proxy:
 *   GET    /api/collections/:id/items/:itemId?siteId= → 200 | 404
 *   PUT    /api/collections/:id/items/:itemId?siteId= → 200 | 404
 *   DELETE /api/collections/:id/items/:itemId?siteId= → 204 | 404
 */
interface CollectionItem {
  id: string;
  collectionId: string;
  data?: Record<string, unknown>;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

function buildPath(id: string, itemId: string, qs: string): string {
  const base = `/collections/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}`;
  return qs ? `${base}?${qs}` : base;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { id, itemId } = await params;
    const qs = new URL(req.url).searchParams.toString();
    const data = await callBackend<CollectionItem>(buildPath(id, itemId, qs), {
      method: "GET",
      headers: h,
    });
    return NextResponse.json(data);
  } catch (e) {
    return toBackendResponse(e);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { id, itemId } = await params;
    const qs = new URL(req.url).searchParams.toString();
    const body = await req.json();
    const data = await callBackend<CollectionItem>(buildPath(id, itemId, qs), {
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
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { id, itemId } = await params;
    const qs = new URL(req.url).searchParams.toString();
    await callBackend<CollectionItem>(buildPath(id, itemId, qs), {
      method: "DELETE",
      headers: h,
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return toBackendResponse(e);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

/**
 * V2-T7 Collection items proxy (nested under /collections/:id/items):
 *   GET  /api/collections/:id/items?siteId= → 200 []
 *   POST /api/collections/:id/items?siteId= → 201 | 404 | 400
 */
interface CollectionItem {
  id: string;
  collectionId: string;
  data?: Record<string, unknown>;
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
    const path = qs
      ? `/collections/${encodeURIComponent(id)}/items?${qs}`
      : `/collections/${encodeURIComponent(id)}/items`;
    const data = await callBackend<CollectionItem[]>(path, { method: "GET", headers: h });
    return NextResponse.json(data);
  } catch (e) {
    return toBackendResponse(e);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { id } = await params;
    const qs = new URL(req.url).searchParams.toString();
    const path = qs
      ? `/collections/${encodeURIComponent(id)}/items?${qs}`
      : `/collections/${encodeURIComponent(id)}/items`;
    const body = await req.json();
    const created = await callBackend<CollectionItem>(path, {
      method: "POST",
      headers: h,
      body: JSON.stringify(body),
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return toBackendResponse(e);
  }
}

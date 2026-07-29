import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

/**
 * Single-datasource proxy:
 *   GET    /api/datasources/:id → 200 | 404
 *   PUT    /api/datasources/:id → 200 | 404 | 409
 *   DELETE /api/datasources/:id → 204 | 404
 */

interface Datasource {
  id: string;
  siteId: string;
  name: string;
  type: string;
  config?: Record<string, unknown>;
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
    const data = await callBackend<Datasource>(`/datasources/${encodeURIComponent(id)}`, {
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { id } = await params;
    const body = await req.json();
    const data = await callBackend<Datasource>(`/datasources/${encodeURIComponent(id)}`, {
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
    await callBackend<void>(`/datasources/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: h,
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return toBackendResponse(e);
  }
}

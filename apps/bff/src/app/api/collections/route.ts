import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

/**
 * V2-T7 Collections proxy routes — thin pass-through to backend /collections.
 *   GET  /api/collections?siteId= → 200 [] (multi-tenant filtered)
 *   POST /api/collections?siteId=  → 201 | 409 | 404 | 400
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

export async function GET(req: NextRequest) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const qs = new URL(req.url).searchParams.toString();
    const path = qs ? `/collections?${qs}` : "/collections";
    const data = await callBackend<Collection[]>(path, { method: "GET", headers: h });
    return NextResponse.json(data);
  } catch (e) {
    return toBackendResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const qs = new URL(req.url).searchParams.toString();
    const path = qs ? `/collections?${qs}` : "/collections";
    const body = await req.json();
    const created = await callBackend<Collection>(path, {
      method: "POST",
      headers: h,
      body: JSON.stringify(body),
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return toBackendResponse(e);
  }
}

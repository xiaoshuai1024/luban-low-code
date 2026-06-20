import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

/**
 * Datasource proxy routes — thin pass-through to the backend's /datasources.
 * All auth is delegated: BFF validates the JWT and injects X-User-ID/X-User-Role;
 * the backend enforces RequireUser/RequireAdmin (plan §9.2). Follows the leads/
 * route.ts pattern (try/catch + toBackendResponse) rather than the older pages/
 * route.ts which lacked error handling.
 *
 *   GET  /api/datasources?siteId= → 200 [] (multi-tenant filtered)
 *   POST /api/datasources          → 201 | 409 | 404 | 400
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

export async function GET(req: NextRequest) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const qs = new URL(req.url).searchParams.toString();
    const path = qs ? `/datasources?${qs}` : "/datasources";
    const data = await callBackend<Datasource[]>(path, { method: "GET", headers: h });
    return NextResponse.json(data);
  } catch (e) {
    return toBackendResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const body = await req.json();
    const created = await callBackend<Datasource>("/datasources", {
      method: "POST",
      headers: h,
      body: JSON.stringify(body),
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return toBackendResponse(e);
  }
}

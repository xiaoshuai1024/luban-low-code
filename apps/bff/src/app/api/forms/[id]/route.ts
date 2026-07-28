import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

/** GET /api/forms/:id?siteId= → 表单详情 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { id } = await params;
    const siteId = new URL(req.url).searchParams.get("siteId") || "";
    const data = await callBackend(`/forms/${id}?siteId=${encodeURIComponent(siteId)}`, {
      method: "GET",
      headers: h,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof SyntaxError) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid JSON body" },
        { status: 400 }
      );
    }
    return toBackendResponse(e);
  }
}

/** PATCH /api/forms/:id?siteId= {...} → 更新表单 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { id } = await params;
    const siteId = new URL(req.url).searchParams.get("siteId") || "";
    const body = await req.json();
    const data = await callBackend(`/forms/${id}?siteId=${encodeURIComponent(siteId)}`, {
      method: "PATCH",
      headers: h,
      body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof SyntaxError) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid JSON body" },
        { status: 400 }
      );
    }
    return toBackendResponse(e);
  }
}

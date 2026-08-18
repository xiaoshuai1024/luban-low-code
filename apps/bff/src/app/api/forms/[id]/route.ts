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
    const body = (await req.json().catch(() => null));
    if (body === null) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid JSON body" },
        { status: 400 }
      );
    }
    const data = await callBackend(`/forms/${id}?siteId=${encodeURIComponent(siteId)}`, {
      method: "PATCH",
      headers: h,
      body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (e) {
    return toBackendResponse(e);
  }
}

/** DELETE /api/forms/:id?siteId= → 删除表单（204；含 leads 时后端 409 FORM_HAS_LEADS；无权限 403） */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { id } = await params;
    const siteId = new URL(req.url).searchParams.get("siteId") || "";
    await callBackend<void>(`/forms/${id}?siteId=${encodeURIComponent(siteId)}`, {
      method: "DELETE",
      headers: h,
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return toBackendResponse(e);
  }
}

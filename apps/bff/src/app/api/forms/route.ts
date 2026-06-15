import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

/** GET /api/forms?siteId= → 表单列表 */
export async function GET(req: NextRequest) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const qs = new URL(req.url).searchParams.toString();
    const data = await callBackend(`/forms?${qs}`, { method: "GET", headers: h });
    return NextResponse.json(data);
  } catch (e) {
    return toBackendResponse(e);
  }
}

/** POST /api/forms {siteId,pageId,name,fieldSchema,...} → 创建表单 */
export async function POST(req: NextRequest) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const body = await req.json();
    const data = await callBackend(`/forms`, {
      method: "POST",
      headers: h,
      body: JSON.stringify(body),
    });
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    return toBackendResponse(e);
  }
}

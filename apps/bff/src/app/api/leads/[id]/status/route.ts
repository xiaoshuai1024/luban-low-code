import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

/** PATCH /api/leads/:id/status?siteId= {status, assigneeId?} → 状态流转 */
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
    const data = await callBackend(
      `/leads/${id}/status?siteId=${encodeURIComponent(siteId)}`,
      { method: "PATCH", headers: h, body: JSON.stringify(body) }
    );
    return NextResponse.json(data);
  } catch (e) {
    return toBackendResponse(e);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";
import { callBackendRaw } from "@/lib/backendClient";

/** GET /api/leads/export?siteId= → CSV 流（callBackendRaw：不走 JSON 解析，但保留超时/头注入/错误映射） */
export async function GET(req: NextRequest) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const siteId = new URL(req.url).searchParams.get("siteId") || "";
    const res = await callBackendRaw(
      `/leads/export?siteId=${encodeURIComponent(siteId)}`,
      { method: "GET", headers: h }
    );
    const csv = await res.text();
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=UTF-8",
        "Content-Disposition": "attachment; filename=leads.csv",
      },
    });
  } catch (e) {
    return toBackendResponse(e);
  }
}

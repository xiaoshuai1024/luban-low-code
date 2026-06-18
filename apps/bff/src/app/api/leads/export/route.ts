import { NextRequest, NextResponse } from "next/server";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";
import { BACKEND_BASE_URL } from "@/lib/backendClient";

/** GET /api/leads/export?siteId= → CSV 流（不走 callBackend 的 JSON 解析） */
export async function GET(req: NextRequest) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const siteId = new URL(req.url).searchParams.get("siteId") || "";
    const res = await fetch(
      `${BACKEND_BASE_URL}/leads/export?siteId=${encodeURIComponent(siteId)}`,
      { method: "GET", headers: h }
    );
    if (!res.ok) {
      try {
        const err = await res.json();
        return NextResponse.json(err, { status: res.status });
      } catch {
        return NextResponse.json(
          { code: "BACKEND_ERROR", message: "Export failed" },
          { status: res.status }
        );
      }
    }
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

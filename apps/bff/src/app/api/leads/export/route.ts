import { NextRequest, NextResponse } from "next/server";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

const BACKEND_BASE_URL =
  process.env.BACKEND_BASE_URL || "http://127.0.0.1:8080/backend";

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
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { code: "BACKEND_ERROR", message: text || `backend ${res.status}` },
        { status: res.status }
      );
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

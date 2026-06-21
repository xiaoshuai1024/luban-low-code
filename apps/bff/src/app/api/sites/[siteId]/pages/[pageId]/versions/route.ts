import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

/**
 * V2-T8 Page versions proxy (list):
 *   GET /api/sites/:siteId/pages/:pageId/versions → 200 [] (no schema in list)
 */
interface PageVersionListItem {
  id: string;
  pageId: string;
  versionNo: number;
  summary?: string;
  createdBy?: string;
  createdAt?: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string; pageId: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { siteId, pageId } = await params;
    const data = await callBackend<PageVersionListItem[]>(
      `/sites/${encodeURIComponent(siteId)}/pages/${encodeURIComponent(pageId)}/versions`,
      { method: "GET", headers: h }
    );
    return NextResponse.json(data);
  } catch (e) {
    return toBackendResponse(e);
  }
}

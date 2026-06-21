import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

/**
 * V2-T8 Single page version proxy:
 *   GET /api/sites/:siteId/pages/:pageId/versions/:versionId → 200 (with schema)
 */
interface PageVersion {
  id: string;
  pageId: string;
  versionNo: number;
  schema?: Record<string, unknown>;
  summary?: string;
  createdBy?: string;
  createdAt?: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string; pageId: string; versionId: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { siteId, pageId, versionId } = await params;
    const data = await callBackend<PageVersion>(
      `/sites/${encodeURIComponent(siteId)}/pages/${encodeURIComponent(pageId)}/versions/${encodeURIComponent(versionId)}`,
      { method: "GET", headers: h }
    );
    return NextResponse.json(data);
  } catch (e) {
    return toBackendResponse(e);
  }
}

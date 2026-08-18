import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

interface PageMeta {
  id: string;
  siteId: string;
  name: string;
  path: string;
  status?: string;
}

/** 下线页面（published→archived）。动作型 POST，无 body；下线后公开端点 404。 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string; pageId: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { siteId, pageId } = await params;
    const page = await callBackend<PageMeta>(
      `/sites/${encodeURIComponent(siteId)}/pages/${encodeURIComponent(pageId)}/unpublish`,
      { method: "POST", headers: h }
    );
    return NextResponse.json(page);
  } catch (e) {
    return toBackendResponse(e);
  }
}

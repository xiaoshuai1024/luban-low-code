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
  schema?: unknown;
  createdAt?: string;
  updatedAt?: string;
}

/** 发布页面（draft→published）。动作型 POST，无 body；透传鉴权头到后端 publish 端点。 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string; pageId: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { siteId, pageId } = await params;
    const page = await callBackend<PageMeta>(
      `/sites/${encodeURIComponent(siteId)}/pages/${encodeURIComponent(pageId)}/publish`,
      { method: "POST", headers: h }
    );
    return NextResponse.json(page);
  } catch (e) {
    return toBackendResponse(e);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

interface PageWithSchema {
  id: string;
  siteId: string;
  name: string;
  path: string;
  status?: string;
  schema?: unknown;
}

/** 预览页面（GET，返回当前内容含 schema，draft 亦可读）。 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string; pageId: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { siteId, pageId } = await params;
    const page = await callBackend<PageWithSchema>(
      `/sites/${encodeURIComponent(siteId)}/pages/${encodeURIComponent(pageId)}/preview`,
      { method: "GET", headers: h }
    );
    return NextResponse.json(page);
  } catch (e) {
    return toBackendResponse(e);
  }
}

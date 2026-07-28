import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

/**
 * POST /api/datasources/:id/test → 200 {ok,message,latencyMs} | 503
 *
 * Probes the configured datasource. The actual outbound HTTP/DB probe happens in
 * the backend (which owns the datasource config), so this route just forwards.
 */

interface TestResult {
  ok: boolean;
  message?: string;
  latencyMs?: number;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { id } = await params;
    const data = await callBackend<TestResult>(
      `/datasources/${encodeURIComponent(id)}/test`,
      { method: "POST", headers: h }
    );
    return NextResponse.json(data);
  } catch (e) {
    return toBackendResponse(e);
  }
}

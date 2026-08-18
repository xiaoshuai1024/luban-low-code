import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

/**
 * PATCH /api/api-keys/{id}/revoke
 *
 * Revoke an API key. The backend returns 204 No Content on success;
 * callBackend handles 204 by returning undefined（backendClient.ts）。
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const headers = authHeaders(parseTokenFromRequest(req));
    if (!headers) return unauthenticated();

    const { id } = await params;

    await callBackend<void>(`/api-keys/${id}/revoke`, {
      method: "PATCH",
      headers,
    });

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    // 后端 403/404 等透传；同时获得 callBackend 的超时与 X-Internal-Auth 注入
    return toBackendResponse(e);
  }
}

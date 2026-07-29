import { NextRequest, NextResponse } from "next/server";
import { parseTokenFromRequest } from "@/lib/authToken";
import { authHeaders, unauthenticated } from "@/lib/apiHandler";
import { BACKEND_BASE_URL } from "@/lib/backendClient";

/**
 * PATCH /api/api-keys/{id}/revoke
 *
 * Revoke an API key. The backend returns 204 No Content on success.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = authHeaders(parseTokenFromRequest(req));
  if (!headers) return unauthenticated();

  const { id } = await params;

  // Use raw fetch because the backend returns 204 with no body, which
  // callBackend would fail to parse as JSON.
  const res = await fetch(`${BACKEND_BASE_URL}/api-keys/${id}/revoke`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...headers },
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    const code = errBody?.code || "INTERNAL";
    const msg = errBody?.message || `Backend error ${res.status}`;
    return NextResponse.json({ code, message: msg }, { status: res.status });
  }

  return new NextResponse(null, { status: 204 });
}

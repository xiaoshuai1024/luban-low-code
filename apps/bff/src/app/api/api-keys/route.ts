import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";
import type {
  ApiKeyResponse,
  ApiKeyCreateResponse,
  ApiKeyCreateRequest,
} from "@/lib/apiKey";

/**
 * GET /api/api-keys
 *
 * List all API keys for the current user.
 */
export async function GET(req: NextRequest) {
  try {
    const headers = authHeaders(parseTokenFromRequest(req));
    if (!headers) return unauthenticated();

    const data = await callBackend<ApiKeyResponse[]>("/api-keys", {
      method: "GET",
      headers,
    });
    return NextResponse.json(data);
  } catch (e) {
    // 后端 4xx/5xx 透传（原实现未捕获会被 Next 兜底成 500）
    return toBackendResponse(e);
  }
}

/**
 * POST /api/api-keys
 *
 * Create a new API key for the current user.
 * The raw apiKey secret is returned only once in the response.
 */
export async function POST(req: NextRequest) {
  try {
    const headers = authHeaders(parseTokenFromRequest(req));
    if (!headers) return unauthenticated();

    const body = (await req.json().catch(() => null)) as ApiKeyCreateRequest | null;
    if (body === null) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid JSON body" },
        { status: 400 }
      );
    }
    const data = await callBackend<ApiKeyCreateResponse>("/api-keys", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    return toBackendResponse(e);
  }
}

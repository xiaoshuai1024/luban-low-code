import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

interface SlugCheckResult {
  available: boolean;
  slug: string;
}

/** GET /api/sites/slug-check?slug= → 站点地址查重（200 available=true / 409 SLUG_TAKEN，Java 裁决） */
export async function GET(req: NextRequest) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const qs = new URL(req.url).searchParams.toString();
    const path = qs ? `/sites/slug-check?${qs}` : "/sites/slug-check";
    const data = await callBackend<SlugCheckResult>(path, {
      method: "GET",
      headers: h,
    });
    return NextResponse.json(data);
  } catch (e) {
    return toBackendResponse(e);
  }
}

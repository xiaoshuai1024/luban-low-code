import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { toBackendResponse } from "@/lib/apiHandler";

interface AbAssignResult {
  experimentId: string;
  variantId: string | null;
  variantKey: string | null;
  status: string;
}

/**
 * 公开 AB 分流代理（免鉴权；e2e ab-full-link.spec.ts AB2/AB3 契约）：
 *   GET /api/public/ab/assign?visitorId=&pageId=（experimentId 可选直查）
 *   → {experimentId, variantId, variantKey, status}；ended → variantId=null
 */
export async function GET(req: NextRequest) {
  try {
    const qs = new URL(req.url).searchParams.toString();
    const data = await callBackend<AbAssignResult>(
      `/public/ab/assign${qs ? `?${qs}` : ""}`,
      { method: "GET" }
    );
    return NextResponse.json(data);
  } catch (e) {
    return toBackendResponse(e);
  }
}

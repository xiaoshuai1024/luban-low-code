import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { toBackendResponse } from "@/lib/apiHandler";

/**
 * 公开 FeatureGate 查询（免鉴权，访客侧；e2e feature-gate spec 契约）：
 *
 *   GET /api/public/feature-gates?siteId=&key= → { enabled: boolean }
 *
 * fail-open 语义由后端保证（未知 key → {enabled:true}），本层仅透传；
 * 不注入用户身份头（公开资源，模拟访客读取）。
 */
export async function GET(req: NextRequest) {
  try {
    const qs = new URL(req.url).searchParams.toString();
    if (!qs) {
      return NextResponse.json(
        { code: "INVALID_ARGUMENT", message: "siteId/key are required" },
        { status: 400 }
      );
    }
    const data = await callBackend<{ enabled: boolean }>(`/public/feature-gates?${qs}`, {
      method: "GET",
    });
    return NextResponse.json(data);
  } catch (e) {
    return toBackendResponse(e);
  }
}

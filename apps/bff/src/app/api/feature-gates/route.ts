import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

interface FeatureGate {
  siteId: string;
  gateKey: string;
  enabled: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/**
 * 管理端 FeatureGate 代理（JWT 鉴权；e2e/flows/feature-gate-*.spec.ts 契约）：
 *
 *   GET /api/feature-gates?siteId=               → 该 site 的 gate 配置列表
 *   PUT /api/feature-gates?siteId=&key=&enabled=  → 配置 upsert（参数走 query string）
 *
 * 归属校验（owner/admin）在后端 FeatureGateController（SiteOwnershipGuard）。
 */
export async function GET(req: NextRequest) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const qs = new URL(req.url).searchParams.toString();
    const path = qs ? `/feature-gates?${qs}` : "/feature-gates";
    const data = await callBackend<FeatureGate[]>(path, { method: "GET", headers: h });
    return NextResponse.json(data);
  } catch (e) {
    return toBackendResponse(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const qs = new URL(req.url).searchParams.toString();
    if (!qs) {
      return NextResponse.json(
        { code: "INVALID_ARGUMENT", message: "siteId/key/enabled are required" },
        { status: 400 }
      );
    }
    const data = await callBackend<FeatureGate>(`/feature-gates?${qs}`, {
      method: "PUT",
      headers: h,
    });
    return NextResponse.json(data);
  } catch (e) {
    return toBackendResponse(e);
  }
}

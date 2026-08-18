import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

interface AbVariantPayload {
  variantKey?: string;
  label?: string;
  weight?: number;
  isControl?: boolean;
  schema?: unknown;
}

interface AbExperimentCreatePayload {
  siteId: string;
  pageId?: string;
  name: string;
  trafficPct?: number;
  status?: string;
  variants: AbVariantPayload[];
}

interface AbVariant {
  id: string;
  variantKey: string;
  weight: number;
  schema?: unknown;
}

interface AbExperiment {
  id: string;
  siteId: string;
  pageId?: string | null;
  name: string;
  status: string;
  startedAt?: string;
  endedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  variants: AbVariant[];
}

interface AbExperimentListResult {
  items: AbExperiment[];
  total: number;
}

/**
 * AB 实验管理端代理（e2e ab-full-link.spec.ts AB1 契约）：
 *   GET  /api/ab/experiments?siteId= → {items,total}（JWT 鉴权）
 *   POST /api/ab/experiments {siteId,pageId,name,variants:[{label,weight,isControl}]}
 *        → 实验对象（顶层 id；trafficPct/status 接受透传，后端以 running 起始）
 */
export async function GET(req: NextRequest) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const qs = new URL(req.url).searchParams.toString();
    const path = qs ? `/ab/experiments?${qs}` : "/ab/experiments";
    const data = await callBackend<AbExperimentListResult>(path, {
      method: "GET",
      headers: h,
    });
    return NextResponse.json(data);
  } catch (e) {
    return toBackendResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const body = (await req.json().catch(() => null)) as AbExperimentCreatePayload | null;
    if (body === null) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid JSON body" },
        { status: 400 }
      );
    }
    const data = await callBackend<AbExperiment>("/ab/experiments", {
      method: "POST",
      headers: h,
      body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (e) {
    return toBackendResponse(e);
  }
}

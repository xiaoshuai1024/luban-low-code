import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

interface SubscribePayload {
  planCode: string;
}

interface SubscribeResult {
  subscription: {
    planCode: string;
    planName?: string;
    status: string;
    startedAt?: string;
    trialEndsAt?: string | null;
  };
}

/** POST /api/billing/subscribe {planCode} → 切换套餐（v02 契约别名，主路径走 /billing/orders） */
export async function POST(req: NextRequest) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    // 前置解析：仅客户端坏 JSON 归 400；外层 catch 只兜后端错误
    const body = (await req.json().catch(() => null)) as SubscribePayload | null;
    if (body === null) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid JSON body" },
        { status: 400 }
      );
    }
    const data = await callBackend<SubscribeResult>("/billing/subscribe", {
      method: "POST",
      headers: h,
      body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (e) {
    return toBackendResponse(e);
  }
}

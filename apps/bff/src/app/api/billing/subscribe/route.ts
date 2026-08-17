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
    const body = (await req.json()) as SubscribePayload;
    const data = await callBackend<SubscribeResult>("/billing/subscribe", {
      method: "POST",
      headers: h,
      body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof SyntaxError) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid JSON body" },
        { status: 400 }
      );
    }
    return toBackendResponse(e);
  }
}

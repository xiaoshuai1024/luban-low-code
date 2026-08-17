import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

interface Subscription {
  planCode: string;
  planName: string;
  status: string;
  trialEndsAt?: string | null;
  usage?: { leads: number; pages: number; visits: number };
  quota?: { leads: number; pages: number; visits: number };
}

/** GET /api/billing/me → 当前用户订阅（无订阅时 Java 回退 free+0） */
export async function GET(req: NextRequest) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const qs = new URL(req.url).searchParams.toString();
    const path = qs ? `/billing/me?${qs}` : "/billing/me";
    const data = await callBackend<Subscription>(path, { method: "GET", headers: h });
    return NextResponse.json(data);
  } catch (e) {
    return toBackendResponse(e);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

interface Plan {
  planCode: string;
  name: string;
  priceMonthly: number;
  quotaLeads: number;
  quotaPages: number;
  quotaVisits: number;
  /** PlanResponse.gates（JsonNode）：放行的 gate_key 集合，DB NULL/非法 JSON 时为 null */
  gates: string[] | null;
  /** PlanResponse.trialDays（int，恒返回） */
  trialDays: number;
}

/** GET /api/billing/plans → 套餐列表（透传 Java 裸数组，不包裹） */
export async function GET(req: NextRequest) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const qs = new URL(req.url).searchParams.toString();
    const path = qs ? `/billing/plans?${qs}` : "/billing/plans";
    const data = await callBackend<Plan[]>(path, { method: "GET", headers: h });
    return NextResponse.json(data);
  } catch (e) {
    return toBackendResponse(e);
  }
}

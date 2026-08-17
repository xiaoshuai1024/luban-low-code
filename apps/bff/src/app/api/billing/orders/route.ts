import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

interface OrderCreatePayload {
  planCode: string;
}

interface Order {
  orderNo: string;
  planCode: string;
  amount: number;
  status: string;
  paidAt?: string | null;
  createdAt?: string;
}

interface Subscription {
  planCode: string;
  planName?: string;
  status: string;
  startedAt?: string;
  trialEndsAt?: string | null;
}

interface OrderCreateResult {
  order: Order;
  subscription: Subscription;
}

interface OrderListResult {
  items: Order[];
  total: number;
}

/**
 * GET  /api/billing/orders?page=&size= → 订单分页列表（{items,total}）
 * POST /api/billing/orders {planCode}  → 下单（0 元直通支付成功，同事务生效订阅）
 */
export async function GET(req: NextRequest) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const qs = new URL(req.url).searchParams.toString();
    const path = qs ? `/billing/orders?${qs}` : "/billing/orders";
    const data = await callBackend<OrderListResult>(path, {
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
    const body = (await req.json()) as OrderCreatePayload;
    const data = await callBackend<OrderCreateResult>("/billing/orders", {
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

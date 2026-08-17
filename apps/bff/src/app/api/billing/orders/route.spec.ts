import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, POST } from "./route";
import { signToken } from "@/lib/authToken";

/**
 * billing/orders route tests：
 *   GET  /api/billing/orders?page=&size= → {items,total}
 *   POST /api/billing/orders {planCode}   → {order,subscription}（0 元直通）
 */

const token = signToken({ id: "u-1", username: "alice", role: "user" });

function makeReq(
  method: "GET" | "POST",
  withToken = true,
  body?: unknown
) {
  const headers: Record<string, string> = {};
  if (withToken) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  return new Request("http://localhost/api/billing/orders", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

function backendResponse(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
    text: async () => JSON.stringify(body ?? {}),
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/billing/orders", () => {
  it("未带 token → 401 UNAUTHENTICATED（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await GET(makeReq("GET", false));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHENTICATED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("后端 200 → BFF 200 透传 {items,total}，分页 query 原样透传", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(200, {
        items: [{ orderNo: "NO-1", planCode: "starter", amount: 0, status: "paid" }],
        total: 1,
      })
    );

    const req = new Request("http://localhost/api/billing/orders?page=1&size=10", {
      headers: { authorization: `Bearer ${token}` },
    }) as unknown as import("next/server").NextRequest;
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.items[0]).toMatchObject({ orderNo: "NO-1", status: "paid" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/billing/orders?page=1&size=10");
    expect((init as RequestInit).method).toBe("GET");
  });
});

describe("POST /api/billing/orders", () => {
  it("未带 token → 401 UNAUTHENTICATED（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await POST(makeReq("POST", false, { planCode: "starter" }));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHENTICATED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("后端 200 → BFF 200 透传 {order,subscription}，JSON body 原样转发", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(200, {
        order: { orderNo: "NO-2", planCode: "starter", amount: 0, status: "paid", paidAt: "2026-08-17T10:00:00Z" },
        subscription: { planCode: "starter", status: "trialing", trialEndsAt: "2026-08-31" },
      })
    );

    const res = await POST(makeReq("POST", true, { planCode: "starter" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.order).toMatchObject({ orderNo: "NO-2", status: "paid", amount: 0 });
    expect(body.subscription).toMatchObject({ planCode: "starter", status: "trialing" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/billing/orders");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      planCode: "starter",
    });
  });

  it("后端 429 QUOTA_EXCEEDED → 透传 429 与错误体（不再变 500）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(429, {
        code: "QUOTA_EXCEEDED",
        message: "套餐页面数已达上限",
        details: { metric: "pages", limit: 3, used: 3 },
      })
    );

    const res = await POST(makeReq("POST", true, { planCode: "free" }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("QUOTA_EXCEEDED");
    expect(body.details).toEqual({ metric: "pages", limit: 3, used: 3 });
  });
});

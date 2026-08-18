import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";
import { signToken } from "@/lib/authToken";

/**
 * billing/plans route tests：透传 Java GET /billing/plans（裸数组，不包裹）。
 */

const token = signToken({ id: "u-1", username: "alice", role: "user" });

function makeReq(withToken = true) {
  const headers: Record<string, string> = {};
  if (withToken) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/billing/plans", {
    headers,
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

describe("GET /api/billing/plans", () => {
  it("未带 token → 401 UNAUTHENTICATED（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await GET(makeReq(false));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHENTICATED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("后端 200 → BFF 200 透传裸数组（不包裹）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const plans = [
      { planCode: "free", name: "Free", priceMonthly: 0, quotaLeads: 100, quotaPages: 3, quotaVisits: 0 },
      { planCode: "starter", name: "Starter", priceMonthly: 0, quotaLeads: 1000, quotaPages: 10, quotaVisits: 0 },
    ];
    fetchMock.mockResolvedValue(backendResponse(200, plans));

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({ planCode: "free", priceMonthly: 0 });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/billing/plans");
    expect((init as RequestInit).method).toBe("GET");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-User-ID"]).toBe("u-1");
    expect(headers["X-User-Role"]).toBe("user");
  });
});

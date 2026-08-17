import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { signToken } from "@/lib/authToken";

/**
 * billing/subscribe route tests：透传 Java POST /billing/subscribe（{subscription}）。
 */

const token = signToken({ id: "u-1", username: "alice", role: "user" });

function makeReq(withToken = true, body: unknown = { planCode: "starter" }) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (withToken) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/billing/subscribe", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
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

describe("POST /api/billing/subscribe", () => {
  it("未带 token → 401 UNAUTHENTICATED（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await POST(makeReq(false));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHENTICATED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("后端 200 → BFF 200 透传 {subscription}，JSON body 原样转发", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(200, {
        subscription: { planCode: "starter", status: "trialing", trialEndsAt: "2026-08-31" },
      })
    );

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subscription).toMatchObject({
      planCode: "starter",
      status: "trialing",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/billing/subscribe");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      planCode: "starter",
    });
  });

  it("后端 400 INVALID_PLAN → 透传 400 与错误体", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(400, { code: "INVALID_PLAN", message: "套餐不存在" })
    );

    const res = await POST(makeReq(true, { planCode: "nope" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_PLAN");
  });
});

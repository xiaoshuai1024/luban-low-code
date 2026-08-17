import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";
import { signToken } from "@/lib/authToken";

/**
 * billing/me route tests：透传 Java GET /billing/me（当前订阅+用量+配额）。
 */

const token = signToken({ id: "u-1", username: "alice", role: "user" });

function makeReq(withToken = true) {
  const headers: Record<string, string> = {};
  if (withToken) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/billing/me", {
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

describe("GET /api/billing/me", () => {
  it("未带 token → 401 UNAUTHENTICATED（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await GET(makeReq(false));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHENTICATED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("后端 200 → BFF 200 透传订阅对象", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(200, {
        planCode: "free",
        planName: "Free",
        status: "active",
        usage: { leads: 40, pages: 2, visits: 0 },
        quota: { leads: 100, pages: 3, visits: 0 },
      })
    );

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ planCode: "free", status: "active" });
    expect(body.usage).toEqual({ leads: 40, pages: 2, visits: 0 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/billing/me");
    expect((init as RequestInit).method).toBe("GET");
  });
});

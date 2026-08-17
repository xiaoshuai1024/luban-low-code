import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";
import { signToken } from "@/lib/authToken";

/**
 * billing/usage route tests：透传 Java GET /billing/usage（query 原样透传）。
 */

const token = signToken({ id: "u-1", username: "alice", role: "user" });

function makeReq(url = "http://localhost/api/billing/usage", withToken = true) {
  const headers: Record<string, string> = {};
  if (withToken) headers.authorization = `Bearer ${token}`;
  return new Request(url, {
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

describe("GET /api/billing/usage", () => {
  it("未带 token → 401 UNAUTHENTICATED（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await GET(makeReq(undefined, false));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHENTICATED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("后端 200 → BFF 200 透传 {period,leads,pages,visits}", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(200, { period: "2026-08", leads: 40, pages: 2, visits: 0 })
    );

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      period: "2026-08",
      leads: 40,
      pages: 2,
      visits: 0,
    });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/billing/usage");
  });

  it("query 原样透传（?period=2026-07）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(200, { period: "2026-07", leads: 1, pages: 1, visits: 0 })
    );

    await GET(makeReq("http://localhost/api/billing/usage?period=2026-07"));
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/billing/usage?period=2026-07");
  });

  it("后端 429 QUOTA_EXCEEDED → 透传 429 与错误体", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(429, {
        code: "QUOTA_EXCEEDED",
        message: "配额已用尽",
        details: { metric: "pages", limit: 3, used: 3 },
      })
    );

    const res = await GET(makeReq());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("QUOTA_EXCEEDED");
    expect(body.details).toEqual({ metric: "pages", limit: 3, used: 3 });
  });
});

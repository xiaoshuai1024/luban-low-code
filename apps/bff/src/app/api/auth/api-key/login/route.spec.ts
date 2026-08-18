import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { resetRateLimiterForTests } from "@/lib/rateLimit";

/**
 * auth/api-key/login route tests：与 auth/login 共用同一按 IP 限流器。
 */

function makeReq(ip = "7.7.7.7") {
  return new Request("http://localhost/api/auth/api-key/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ apiKey: "lk_bad_key" }),
  });
}

function backendFail() {
  return {
    ok: false,
    status: 401,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({ code: "INVALID_API_KEY", message: "bad key" }),
  } as unknown as Response;
}

function backendOk() {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({ userId: "u-2", username: "svc", role: "user" }),
  } as unknown as Response;
}

beforeEach(() => {
  resetRateLimiterForTests();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/auth/api-key/login 限流", () => {
  it("10 次失败后第 11 次 429 RATE_LIMITED", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendFail());

    for (let i = 0; i < 10; i++) {
      const res = await POST(makeReq());
      expect(res.status).toBe(401);
    }
    const res = await POST(makeReq());
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("RATE_LIMITED");
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it("成功校验 → 签发 token 且不计失败", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendOk());
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.token).toBe("string");
    expect(body.user).toMatchObject({ username: "svc", role: "user" });
  });
});

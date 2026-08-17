import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { resetRateLimiterForTests } from "@/lib/rateLimit";

/**
 * auth/login route tests：按 IP 限流（10 次失败 / 15 分钟窗口 → 429）。
 * 窗口算法的穷举见 lib/__tests__/rateLimit.spec.ts，这里验证 route 接线。
 */

function makeReq(ip = "9.9.9.9") {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ username: "alice", password: "wrong" }),
  });
}

function backendFail() {
  return {
    ok: false,
    status: 401,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({ code: "UNAUTHENTICATED", message: "bad credentials" }),
  } as unknown as Response;
}

function backendOk() {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({
      user: { id: "u-1", username: "alice", role: "admin" },
      claims: { userId: "u-1", role: "admin" },
    }),
  } as unknown as Response;
}

beforeEach(() => {
  resetRateLimiterForTests();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/auth/login 限流", () => {
  it("同一 IP 10 次失败内放行（401 透传），第 11 次 429 且不再打到后端", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendFail());

    for (let i = 0; i < 10; i++) {
      const res = await POST(makeReq());
      expect(res.status).toBe(401);
    }
    expect(fetchMock).toHaveBeenCalledTimes(10);

    const res = await POST(makeReq());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("RATE_LIMITED");
    // 限流命中后不再请求后端
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it("成功登录不计入失败窗口", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    // 9 次失败 + 1 次成功 + 1 次失败 = 10 次失败，此时仍未限流；再下一次失败后才触发
    for (let i = 0; i < 9; i++) fetchMock.mockResolvedValueOnce(backendFail());
    fetchMock.mockResolvedValueOnce(backendOk());
    fetchMock.mockResolvedValue(backendFail());

    for (let i = 0; i < 9; i++) await POST(makeReq());
    const ok = await POST(makeReq());
    expect(ok.status).toBe(200);
    const fail = await POST(makeReq());
    expect(fail.status).toBe(401);
    // 第 12 次（失败已达 10）→ 429
    const limited = await POST(makeReq());
    expect(limited.status).toBe(429);
  });

  it("不同 IP 互不影响", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendFail());
    for (let i = 0; i < 10; i++) await POST(makeReq("9.9.9.9"));
    const res = await POST(makeReq("8.8.8.8"));
    expect(res.status).toBe(401);
  });
});

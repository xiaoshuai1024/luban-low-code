import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { resetRateLimiterForTests } from "@/lib/rateLimit";

/**
 * auth/register/resend route tests：透传 Java 重发验证码；
 * 冷却/日限（429 VERIFY_RESEND_*）由后端裁决、BFF 透传；BFF 自身 IP 限流 scope=resend。
 */

function makeReq(ip = "9.9.9.9") {
  return new Request("http://localhost/api/auth/register/resend", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ email: "alice@example.com" }),
  });
}

function backendOk() {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({ emailMasked: "a***@example.com", devCode: "654321" }),
  } as unknown as Response;
}

function backendCooldown() {
  return {
    ok: false,
    status: 429,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({
      code: "VERIFY_RESEND_COOLDOWN",
      message: "发送过于频繁，请稍后再试",
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

describe("POST /api/auth/register/resend", () => {
  it("后端 200 → BFF 200 且响应体原样透传（含 devCode）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendOk());

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ emailMasked: "a***@example.com", devCode: "654321" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/auth/register/resend");
    expect((init as RequestInit).method).toBe("POST");
  });

  it("后端 429 VERIFY_RESEND_COOLDOWN → 透传 429 与错误体 code 字段", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendCooldown());

    const res = await POST(makeReq());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("VERIFY_RESEND_COOLDOWN");
    expect(body.error).toBeUndefined();
  });

  it("同一 IP 10 次失败后第 11 次 BFF 自身限流 429（code=RATE_LIMITED）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendCooldown());

    // 前 10 次：透传后端的冷却 429
    for (let i = 0; i < 10; i++) {
      const res = await POST(makeReq());
      expect(res.status).toBe(429);
    }
    expect(fetchMock).toHaveBeenCalledTimes(10);

    // 第 11 次：命中 BFF scope=resend 限流窗口，不再打到后端
    const res = await POST(makeReq());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("RATE_LIMITED");
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });
});

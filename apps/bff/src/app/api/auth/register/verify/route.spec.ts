import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import jwt from "jsonwebtoken";
import { POST } from "./route";
import { resetRateLimiterForTests } from "@/lib/rateLimit";

/**
 * auth/register/verify route tests：验证码校验通过后 BFF 组装 {token,user}
 * （signToken，剥离 user.id）；限流 scope=verify；错误体 code 字段。
 */

function makeReq(ip = "9.9.9.9") {
  return new Request("http://localhost/api/auth/register/verify", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ email: "alice@example.com", code: "123456" }),
  });
}

function backendOk() {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({
      user: {
        id: "u-1",
        username: "alice",
        name: "Alice",
        role: "user",
        status: "active",
      },
    }),
  } as unknown as Response;
}

function backendInvalidCode() {
  return {
    ok: false,
    status: 400,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({
      code: "VERIFY_CODE_INVALID",
      message: "验证码错误",
      details: { remainingAttempts: 3 },
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

describe("POST /api/auth/register/verify", () => {
  it("后端 200 {user} → BFF 200 {token,user{username,name,role}}，剥离 id/status", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendOk());

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.token).toBe("string");
    expect(body.token.split(".")).toHaveLength(3); // JWT 三段
    expect(body.user).toEqual({ username: "alice", name: "Alice", role: "user" });
    expect(body.user.id).toBeUndefined();
    expect(body.user.status).toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/auth/register/verify");
    expect((init as RequestInit).method).toBe("POST");
  });

  it("token 接线钉死：signToken 同一 secret 可 jwt.verify 解码，sub/username/role 与后端 user 一致", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendOk());

    const res = await POST(makeReq());
    const body = await res.json();
    const secret = process.env.AUTH_JWT_SECRET || "dev-secret-change-me-in-prod";
    const decoded = jwt.verify(body.token, secret) as {
      sub: string;
      username: string;
      role: string;
    };
    expect(decoded.sub).toBe("u-1");
    expect(decoded.username).toBe("alice");
    expect(decoded.role).toBe("user");
  });

  it("客户端坏 JSON body → 400 BAD_REQUEST，且不请求后端", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const req = new Request("http://localhost/api/auth/register/verify", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "6.6.6.6" },
      body: "not-json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("BAD_REQUEST");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("后端 200 但响应体非法 JSON（SyntaxError 来自后端）→ 500 INTERNAL，不再误归因为 400 BAD_REQUEST", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => JSON.parse("not-json"),
    } as unknown as Response);

    const res = await POST(makeReq());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("INTERNAL");
  });

  it("后端 400 VERIFY_CODE_INVALID → 透传 400 与 code/message/details", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendInvalidCode());

    const res = await POST(makeReq());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VERIFY_CODE_INVALID");
    expect(body.message).toBe("验证码错误");
    expect(body.details).toEqual({ remainingAttempts: 3 });
  });

  it("同一 IP 10 次失败后第 11 次 429（code=RATE_LIMITED），不再打到后端", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendInvalidCode());

    for (let i = 0; i < 10; i++) {
      const res = await POST(makeReq());
      expect(res.status).toBe(400);
    }
    expect(fetchMock).toHaveBeenCalledTimes(10);

    const res = await POST(makeReq());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("RATE_LIMITED");
    expect(body.error).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it("不同 IP 互不影响", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendInvalidCode());
    for (let i = 0; i < 10; i++) await POST(makeReq("9.9.9.9"));
    const res = await POST(makeReq("8.8.8.8"));
    expect(res.status).toBe(400);
  });
});

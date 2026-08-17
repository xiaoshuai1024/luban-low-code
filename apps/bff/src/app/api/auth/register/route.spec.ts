import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { POST as loginPOST } from "../login/route";
import { resetRateLimiterForTests } from "@/lib/rateLimit";

/**
 * auth/register route tests：按 IP 限流（scope=register，10 次失败 / 15 分钟窗口 → 429）。
 * 窗口算法的穷举见 lib/__tests__/rateLimit.spec.ts，这里验证 route 接线与错误体 code 字段。
 */

function makeReq(ip = "9.9.9.9", body?: unknown) {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(
      body ?? { username: "alice", email: "alice@example.com", password: "passw0rd1" }
    ),
  });
}

function backendFail() {
  return {
    ok: false,
    status: 409,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({ code: "USERNAME_TAKEN", message: "用户名已被占用" }),
  } as unknown as Response;
}

function backendOk() {
  return {
    ok: true,
    status: 201,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({
      username: "alice",
      emailMasked: "a***@example.com",
      devCode: "123456",
    }),
  } as unknown as Response;
}

function invalidJsonReq() {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "6.6.6.6" },
    body: "not-json",
  });
}

beforeEach(() => {
  resetRateLimiterForTests();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/auth/register", () => {
  it("后端 201 → BFF 201 且响应体原样透传（含 devCode）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendOk());

    const res = await POST(makeReq());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({
      username: "alice",
      emailMasked: "a***@example.com",
      devCode: "123456",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/auth/register");
    expect((init as RequestInit).method).toBe("POST");
  });

  it("后端 409 USERNAME_TAKEN → 透传 409，错误体用 code 字段", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendFail());

    const res = await POST(makeReq());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("USERNAME_TAKEN");
    expect(body.message).toBe("用户名已被占用");
    expect(body.error).toBeUndefined();
  });

  it("body 非法 JSON → 400 BAD_REQUEST（code 字段）", async () => {
    const res = await POST(invalidJsonReq());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("BAD_REQUEST");
  });

  it("同一 IP 10 次失败内放行，第 11 次 429（code=RATE_LIMITED）且不再打到后端", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendFail());

    for (let i = 0; i < 10; i++) {
      const res = await POST(makeReq());
      expect(res.status).toBe(409);
    }
    expect(fetchMock).toHaveBeenCalledTimes(10);

    const res = await POST(makeReq());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("RATE_LIMITED");
    expect(body.error).toBeUndefined();
    // 限流命中后不再请求后端
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it("scope 隔离：login 维度的失败不计入 register 窗口", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendFail());

    // 同一 IP 打满 login scope 的 10 次失败（每次新 Request：body 只能消费一次）
    const loginReq = () =>
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.9" },
        body: JSON.stringify({ username: "alice", password: "wrong" }),
      });
    for (let i = 0; i < 10; i++) await loginPOST(loginReq());

    // register scope 不受影响，仍放行到后端
    const res = await POST(makeReq());
    expect(res.status).toBe(409);
    expect(fetchMock).toHaveBeenCalledTimes(11);
  });
});

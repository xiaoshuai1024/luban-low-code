import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, PUT } from "./route";
import { signToken } from "@/lib/authToken";

/**
 * users/[id] route tests：代理后端用户详情/更新。
 * 回归锁：未包 try/catch 时后端 404/403 会被 Next 兜底成 500，修复后必须透传。
 */

const token = signToken({ id: "u-1", username: "admin", role: "admin" });

function makeReq(method: "GET" | "PUT", withToken = true, rawBody?: string) {
  const headers: Record<string, string> = {};
  if (withToken) headers.authorization = `Bearer ${token}`;
  if (rawBody !== undefined) headers["content-type"] = "application/json";
  return new Request("http://localhost/api/users/u-9", {
    method,
    headers,
    body: rawBody,
  }) as unknown as import("next/server").NextRequest;
}

const params = () => ({ params: Promise.resolve({ id: "u-9" }) });

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

describe("GET /api/users/:id", () => {
  it("未带 token → 401（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await GET(makeReq("GET", false), params());
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("后端 200 → 透传用户详情", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(200, { id: "u-9", username: "bob" })
    );

    const res = await GET(makeReq("GET"), params());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: "u-9", username: "bob" });
  });

  it("后端 404 → 透传 404（回归：不再变 500）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(404, { code: "NOT_FOUND", message: "user missing" })
    );

    const res = await GET(makeReq("GET"), params());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("NOT_FOUND");
    expect(body.message).toBe("user missing");
  });
});

describe("PUT /api/users/:id", () => {
  it("后端 200 → 透传更新结果", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(200, { id: "u-9", username: "bob", name: "Bob" })
    );

    const res = await PUT(makeReq("PUT", true, JSON.stringify({ name: "Bob" })), params());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ name: "Bob" });
  });

  it("后端 403 → 透传 403（回归：不再变 500）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(403, { code: "PERMISSION_DENIED", message: "forbidden" })
    );

    const res = await PUT(makeReq("PUT", true, JSON.stringify({ name: "x" })), params());
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("PERMISSION_DENIED");
  });

  it("客户端坏 JSON → 400 BAD_REQUEST（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await PUT(makeReq("PUT", true, "not-json"), params());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("BAD_REQUEST");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

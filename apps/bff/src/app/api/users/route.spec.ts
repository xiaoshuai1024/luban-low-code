import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, POST } from "./route";
import { signToken } from "@/lib/authToken";

/**
 * users route tests：代理后端用户分页列表/新建。
 * 回归锁：原实现对非 403 错误 re-throw（被 Next 兜底成 500），修复后统一透传；
 * 403 保留面向管理后台的友好文案。
 */

const token = signToken({ id: "u-1", username: "admin", role: "admin" });

function makeReq(method: "GET" | "POST", withToken = true, rawBody?: string) {
  const url = "http://localhost/api/users?page=1&size=10&keyword=bob";
  const headers: Record<string, string> = {};
  if (withToken) headers.authorization = `Bearer ${token}`;
  if (rawBody !== undefined) headers["content-type"] = "application/json";
  const req = new Request(url, { method, headers, body: rawBody });
  // 路由使用 req.nextUrl.searchParams，普通 Request 上手动补齐
  Object.defineProperty(req, "nextUrl", { value: new URL(url) });
  return req as unknown as import("next/server").NextRequest;
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

describe("GET /api/users", () => {
  it("未带 token → 401（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await GET(makeReq("GET", false));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("后端 200 → 透传分页列表并转发查询参数", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(200, { list: [{ id: "u-9" }], total: 1 })
    );

    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ list: [{ id: "u-9" }], total: 1 });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/users?page=1&size=10&keyword=bob");
  });

  it("后端 403 → 友好文案 PERMISSION_DENIED（既有语义保留）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(403, { code: "PERMISSION_DENIED", message: "forbidden" })
    );

    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("PERMISSION_DENIED");
    expect(body.message).toContain("管理员");
  });

  it("后端 500 → 透传 500（回归：原实现 re-throw 被 Next 兜底）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(500, { code: "INTERNAL", message: "db down" })
    );

    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("INTERNAL");
  });
});

describe("POST /api/users", () => {
  it("后端 201 → BFF 201", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(201, { id: "u-9", username: "bob" })
    );

    const res = await POST(makeReq("POST", true, JSON.stringify({ username: "bob" })));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ username: "bob" });
  });

  it("后端 409（用户名冲突）→ 透传 409（回归：不再变 500）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(409, { code: "USERNAME_TAKEN", message: "用户名已存在" })
    );

    const res = await POST(makeReq("POST", true, JSON.stringify({ username: "bob" })));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("USERNAME_TAKEN");
  });

  it("客户端坏 JSON → 400 BAD_REQUEST（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await POST(makeReq("POST", true, "not-json"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("BAD_REQUEST");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

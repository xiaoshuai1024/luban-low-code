import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, POST } from "./route";
import { signToken } from "@/lib/authToken";

/**
 * sites/[siteId]/pages route tests：代理后端站点页面接口。
 * 回归锁：POST 未包 try/catch 时后端 429 QUOTA_EXCEEDED 会被转成 500，修复后必须透传 429。
 */

const token = signToken({ id: "u-1", username: "alice", role: "user" });

function makeReq(method: "GET" | "POST", withToken = true, body?: unknown) {
  const headers: Record<string, string> = {};
  if (withToken) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  return new Request("http://localhost/api/sites/s-1/pages", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

const params = () => ({ params: Promise.resolve({ siteId: "s-1" }) });

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

describe("GET /api/sites/:siteId/pages", () => {
  it("未带 token → 401 UNAUTHENTICATED（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await GET(makeReq("GET", false), params());
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHENTICATED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("后端 200 → BFF 200 透传页面数组", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(200, [{ id: "p-1", siteId: "s-1", name: "首页", path: "/" }])
    );

    const res = await GET(makeReq("GET"), params());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0]).toMatchObject({ id: "p-1", path: "/" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/sites/s-1/pages");
    expect((init as RequestInit).method).toBe("GET");
    // authHeaders 重构等价锁：JWT 校验后注入身份头（role 兜底 "user"）
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-User-ID"]).toBe("u-1");
    expect(headers["X-User-Role"]).toBe("user");
  });

  it("非站点所有者 → 后端 403 PERMISSION_DENIED 透传", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(403, {
        code: "PERMISSION_DENIED",
        message: "无权查看此站点",
      })
    );

    const res = await GET(makeReq("GET"), params());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("PERMISSION_DENIED");
    expect(body.message).toBe("无权查看此站点");
  });
});

describe("POST /api/sites/:siteId/pages", () => {
  it("后端 201 → BFF 201 透传新建页面", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(201, { id: "p-2", siteId: "s-1", name: "首页", path: "/" })
    );

    const res = await POST(
      makeReq("POST", true, { name: "首页", path: "/" }),
      params()
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ id: "p-2" });
  });

  it("后端 429 QUOTA_EXCEEDED → 透传 429（回归：不再变 500）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(429, {
        code: "QUOTA_EXCEEDED",
        message: "套餐页面数已达上限",
        details: { metric: "pages", limit: 3, used: 3 },
      })
    );

    const res = await POST(
      makeReq("POST", true, { name: "第二页", path: "/about" }),
      params()
    );
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("QUOTA_EXCEEDED");
    expect(body.details).toEqual({ metric: "pages", limit: 3, used: 3 });
  });

  it("body 非法 JSON → 400 BAD_REQUEST（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const req = new Request("http://localhost/api/sites/s-1/pages", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: "not-json",
    }) as unknown as import("next/server").NextRequest;

    const res = await POST(req, params());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("BAD_REQUEST");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

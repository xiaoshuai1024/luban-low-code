import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, PUT } from "./route";
import { signToken } from "@/lib/authToken";

/**
 * feature-gates route tests（管理端代理，JWT 鉴权）：
 *   GET  /api/feature-gates?siteId=              → 透传列表
 *   PUT  /api/feature-gates?siteId=&key=&enabled= → 透传 upsert 结果
 *   未带 token → 401；后端错误（403/404/400）原样透传 status+code
 */

const token = signToken({ id: "u-1", username: "alice", role: "user" });

function makeReq(method: "GET" | "PUT", withToken = true, url = "http://localhost/api/feature-gates") {
  const headers: Record<string, string> = {};
  if (withToken) headers.authorization = `Bearer ${token}`;
  return new Request(url, { method, headers }) as unknown as import("next/server").NextRequest;
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

describe("GET /api/feature-gates", () => {
  it("未带 token → 401 UNAUTHENTICATED（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await GET(makeReq("GET", false));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHENTICATED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("后端 200 → BFF 200 透传列表，siteId query 原样透传 + 注入身份头", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(200, [
        { siteId: "s-1", gateKey: "lead_capture", enabled: false },
        { siteId: "s-1", gateKey: "realtime_collab", enabled: true },
      ])
    );

    const res = await GET(
      makeReq("GET", true, "http://localhost/api/feature-gates?siteId=s-1")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({ gateKey: "lead_capture", enabled: false });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/feature-gates?siteId=s-1");
    expect((init as RequestInit).method).toBe("GET");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-User-ID"]).toBe("u-1");
    expect(headers["X-User-Role"]).toBe("user");
  });

  it("后端 403 PERMISSION_DENIED（非 owner）→ BFF 原样透传", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(403, { code: "PERMISSION_DENIED", message: "仅站点所有者或管理员可操作此站点" })
    );

    const res = await GET(
      makeReq("GET", true, "http://localhost/api/feature-gates?siteId=others-site")
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("PERMISSION_DENIED");
  });
});

describe("PUT /api/feature-gates", () => {
  it("未带 token → 401 UNAUTHENTICATED（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await PUT(makeReq("PUT", false));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHENTICATED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("后端 200 → BFF 200 透传 upsert 结果，query 原样透传", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(200, {
        siteId: "s-1",
        gateKey: "lead_capture",
        enabled: false,
        createdAt: "2026-08-17T10:00:00Z",
        updatedAt: "2026-08-17T10:00:00Z",
      })
    );

    const res = await PUT(
      makeReq(
        "PUT",
        true,
        "http://localhost/api/feature-gates?siteId=s-1&key=lead_capture&enabled=false"
      )
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ gateKey: "lead_capture", enabled: false });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(
      "/feature-gates?siteId=s-1&key=lead_capture&enabled=false"
    );
    expect((init as RequestInit).method).toBe("PUT");
  });

  it("缺 query 参数 → 400 INVALID_ARGUMENT（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await PUT(makeReq("PUT", true));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_ARGUMENT");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("后端 404 SITE_NOT_FOUND → BFF 原样透传", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(404, { code: "SITE_NOT_FOUND", message: "站点不存在" })
    );

    const res = await PUT(
      makeReq("PUT", true, "http://localhost/api/feature-gates?siteId=no-such&key=k&enabled=true")
    );
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("SITE_NOT_FOUND");
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, PUT } from "./route";
import { signToken } from "@/lib/authToken";

/**
 * settings route tests：代理后端系统设置。
 * 回归锁：未包 try/catch 时后端 403/404 会被 Next 兜底成 500，修复后必须透传。
 */

const token = signToken({ id: "u-1", username: "admin", role: "admin" });

function makeReq(method: "GET" | "PUT", withToken = true, rawBody?: string) {
  const headers: Record<string, string> = {};
  if (withToken) headers.authorization = `Bearer ${token}`;
  if (rawBody !== undefined) headers["content-type"] = "application/json";
  return new Request("http://localhost/api/settings", {
    method,
    headers,
    body: rawBody,
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

describe("GET /api/settings", () => {
  it("未带 token → 401（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await GET(makeReq("GET", false));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("后端 200 → 透传设置 JSON", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendResponse(200, { theme: "dark" }));

    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ theme: "dark" });
  });

  it("后端 403 → 透传 403（回归：不再变 500）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(403, { code: "PERMISSION_DENIED", message: "forbidden" })
    );

    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("PERMISSION_DENIED");
  });
});

describe("PUT /api/settings", () => {
  it("后端 200 → 透传更新结果", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendResponse(200, { theme: "light" }));

    const res = await PUT(makeReq("PUT", true, JSON.stringify({ theme: "light" })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ theme: "light" });
  });

  it("后端 404 → 透传 404（回归：不再变 500）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(404, { code: "NOT_FOUND", message: "settings missing" })
    );

    const res = await PUT(makeReq("PUT", true, JSON.stringify({ theme: "light" })));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NOT_FOUND");
  });

  it("客户端坏 JSON → 400 BAD_REQUEST（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await PUT(makeReq("PUT", true, "not-json"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("BAD_REQUEST");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

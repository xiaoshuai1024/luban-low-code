import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, POST } from "./route";
import { signToken } from "@/lib/authToken";

/**
 * sites route tests：代理后端站点列表/新建。
 * 回归锁：未包 try/catch 时后端 500/409 会被 Next 兜底成 500，修复后必须透传。
 */

const token = signToken({ id: "u-1", username: "alice", role: "user" });

function makeReq(method: "GET" | "POST", withToken = true, rawBody?: string) {
  const headers: Record<string, string> = {};
  if (withToken) headers.authorization = `Bearer ${token}`;
  if (rawBody !== undefined) headers["content-type"] = "application/json";
  return new Request("http://localhost/api/sites", {
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

describe("GET /api/sites", () => {
  it("未带 token → 401（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await GET(makeReq("GET", false));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("后端 200 → 透传站点数组", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(200, [{ id: "s-1", name: "官网", slug: "official" }])
    );

    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0]).toMatchObject({ id: "s-1", slug: "official" });
  });

  it("后端 500 → 透传 500 与错误体（回归：不再被兜底吞掉细节）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(500, { code: "INTERNAL", message: "db down" })
    );

    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("INTERNAL");
    expect(body.message).toBe("db down");
  });
});

describe("POST /api/sites", () => {
  it("后端 201 → BFF 201", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(201, { id: "s-2", name: "新站", slug: "new" })
    );

    const res = await POST(makeReq("POST", true, JSON.stringify({ name: "新站", slug: "new" })));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ id: "s-2" });
  });

  it("后端 409 SLUG_CONFLICT → 透传 409（回归：不再变 500）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(409, { code: "SLUG_CONFLICT", message: "slug 已被占用" })
    );

    const res = await POST(makeReq("POST", true, JSON.stringify({ name: "x", slug: "taken" })));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("SLUG_CONFLICT");
  });

  it("客户端坏 JSON → 400 BAD_REQUEST（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await POST(makeReq("POST", true, "not-json"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("BAD_REQUEST");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

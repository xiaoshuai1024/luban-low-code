import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, POST } from "./route";
import { signToken } from "@/lib/authToken";

/**
 * api-keys route tests：代理后端 API Key 列表/新建。
 * 回归锁：未包 try/catch 时后端 4xx/5xx 会被 Next 兜底成 500，修复后必须透传。
 */

const token = signToken({ id: "u-1", username: "alice", role: "user" });

function makeReq(method: "GET" | "POST", withToken = true, rawBody?: string) {
  const headers: Record<string, string> = {};
  if (withToken) headers.authorization = `Bearer ${token}`;
  if (rawBody !== undefined) headers["content-type"] = "application/json";
  return new Request("http://localhost/api/api-keys", {
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

describe("GET /api/api-keys", () => {
  it("未带 token → 401（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await GET(makeReq("GET", false));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("后端 200 → 透传密钥列表（不含明文 secret）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(200, [
        { id: "k-1", name: "ci", prefix: "lk_ci", createdAt: "2026-08-01" },
      ])
    );

    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0]).toMatchObject({ id: "k-1", name: "ci" });
  });

  it("后端 500 → 透传 500（回归：不再变 Next 兜底）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(500, { code: "INTERNAL", message: "db down" })
    );

    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("INTERNAL");
  });
});

describe("POST /api/api-keys", () => {
  it("后端 201 → BFF 201（明文 apiKey 仅本次返回）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(201, { id: "k-2", name: "ci", apiKey: "lk_live_plain" })
    );

    const res = await POST(makeReq("POST", true, JSON.stringify({ name: "ci" })));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ apiKey: "lk_live_plain" });
  });

  it("后端 400（名称缺失）→ 透传 400（回归：不再变 500）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(400, { code: "INVALID_ARGUMENT", message: "name required" })
    );

    const res = await POST(makeReq("POST", true, JSON.stringify({})));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_ARGUMENT");
  });

  it("客户端坏 JSON → 400 BAD_REQUEST（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await POST(makeReq("POST", true, "not-json"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("BAD_REQUEST");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

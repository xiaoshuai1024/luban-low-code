import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";
import { signToken } from "@/lib/authToken";

/**
 * auth/me route tests：JWT 身份 + 后端角色回填。
 * 回归锁：未包 try/catch 时后端错误会被 Next 兜底成 500，修复后必须透传。
 */

const token = signToken({ id: "u-1", username: "alice", role: "user" });

function makeReq(withToken = true) {
  const headers: Record<string, string> = {};
  if (withToken) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/auth/me", {
    method: "GET",
    headers,
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

describe("GET /api/auth/me", () => {
  it("未带 token → 401（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await GET(makeReq(false));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("后端 200 → 用后端角色回填（角色以最新为准）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendResponse(200, { id: "u-1", role: "admin" }));

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.username).toBe("alice");
    expect(body.role).toBe("admin");
  });

  it("后端无角色 → 回退 JWT 角色", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendResponse(200, { id: "u-1" }));

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expect((await res.json()).role).toBe("user");
  });

  it("后端 401 → 透传 401（回归：不再变 500）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(401, { code: "UNAUTHENTICATED", message: "token revoked" })
    );

    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHENTICATED");
  });
});

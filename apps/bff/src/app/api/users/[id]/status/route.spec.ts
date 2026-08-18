import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PATCH } from "./route";
import { signToken } from "@/lib/authToken";

/**
 * users/[id]/status route tests：代理后端启停用户。
 * 回归锁：未包 try/catch 时后端 403 会被 Next 兜底成 500，修复后必须透传。
 */

const token = signToken({ id: "u-1", username: "admin", role: "admin" });

function makeReq(withToken = true, rawBody?: string) {
  const headers: Record<string, string> = {};
  if (withToken) headers.authorization = `Bearer ${token}`;
  if (rawBody !== undefined) headers["content-type"] = "application/json";
  return new Request("http://localhost/api/users/u-9/status", {
    method: "PATCH",
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

describe("PATCH /api/users/:id/status", () => {
  it("未带 token → 401（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await PATCH(makeReq(false), params());
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("后端 200 → 透传状态变更结果", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(200, { id: "u-9", status: "DISABLED" })
    );

    const res = await PATCH(makeReq(true, JSON.stringify({ status: "DISABLED" })), params());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "DISABLED" });
  });

  it("后端 403 → 透传 403（回归：不再变 500）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(403, { code: "PERMISSION_DENIED", message: "forbidden" })
    );

    const res = await PATCH(makeReq(true, JSON.stringify({ status: "DISABLED" })), params());
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("PERMISSION_DENIED");
  });

  it("客户端坏 JSON → 400 BAD_REQUEST（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await PATCH(makeReq(true, "not-json"), params());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("BAD_REQUEST");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

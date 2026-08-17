import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { signToken } from "@/lib/authToken";

/**
 * /api/ab/experiments/:id/end route tests：
 *   POST → 后端 /ab/experiments/:id/end（幂等结束）；未鉴权 401
 */

const token = signToken({ id: "u-1", username: "alice", role: "user" });

function makeReq(withToken = true, id = "exp-1") {
  const headers: Record<string, string> = {};
  if (withToken) headers.authorization = `Bearer ${token}`;
  return new Request(`http://localhost/api/ab/experiments/${id}/end`, {
    method: "POST",
    headers,
  }) as unknown as import("next/server").NextRequest;
}

/** 路由 handler 的第二参（Next 15+ dynamic params 为 Promise）。 */
function routeParams(id: string) {
  return { params: Promise.resolve({ id }) };
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

describe("POST /api/ab/experiments/:id/end", () => {
  it("未带 token → 401 UNAUTHENTICATED（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await POST(makeReq(false), routeParams("exp-1"));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHENTICATED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("后端 200 → 透传 ended 实验对象，路径含 /ab/experiments/:id/end", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(200, {
        id: "exp-1",
        siteId: "site-1",
        name: "e",
        status: "ended",
        endedAt: "2026-08-17T10:00:00Z",
        variants: [],
      })
    );

    const res = await POST(makeReq(true, "exp-1"), routeParams("exp-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ended");
    expect(body.endedAt).toBe("2026-08-17T10:00:00Z");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/ab/experiments/exp-1/end");
    expect((init as RequestInit).method).toBe("POST");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-User-ID"]).toBe("u-1");
  });

  it("id 特殊字符 → encodeURIComponent 编码进路径", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(200, { id: "a b", status: "ended", variants: [] })
    );

    await POST(makeReq(true, "a b"), routeParams("a b"));
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/ab/experiments/a%20b/end");
  });

  it("后端 404 AB_EXPERIMENT_NOT_FOUND → 透传", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(404, { code: "AB_EXPERIMENT_NOT_FOUND", message: "实验不存在" })
    );

    const res = await POST(makeReq(true, "nope"), routeParams("nope"));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("AB_EXPERIMENT_NOT_FOUND");
  });
});

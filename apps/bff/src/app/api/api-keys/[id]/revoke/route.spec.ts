import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PATCH } from "./route";
import { signToken } from "@/lib/authToken";

/**
 * api-keys/[id]/revoke route tests：走 callBackend（超时/错误契约统一），
 * 后端 204 → BFF 204 空体；4xx 透传。
 * 回归锁：原实现裸 fetch 无超时且错误体手工解析，改 callBackend 后语义不变。
 */

const token = signToken({ id: "u-1", username: "alice", role: "user" });

function makeReq(withToken = true) {
  const headers: Record<string, string> = {};
  if (withToken) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/api-keys/k-1/revoke", {
    method: "PATCH",
    headers,
  }) as unknown as import("next/server").NextRequest;
}

const params = () => ({ params: Promise.resolve({ id: "k-1" }) });

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

describe("PATCH /api/api-keys/:id/revoke", () => {
  it("未带 token → 401（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await PATCH(makeReq(false), params());
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("后端 204 → BFF 204 空体", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendResponse(204));

    const res = await PATCH(makeReq(), params());
    expect(res.status).toBe(204);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api-keys/k-1/revoke");
    expect((init as RequestInit).method).toBe("PATCH");
    // 经 callBackend：必须有超时信号（裸 fetch 无超时的回归锁）
    expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal);
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-User-ID"]).toBe("u-1");
  });

  it("后端 404 → 透传 404 与错误体", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(404, { code: "NOT_FOUND", message: "key missing" })
    );

    const res = await PATCH(makeReq(), params());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("NOT_FOUND");
    expect(body.message).toBe("key missing");
  });

  it("后端 409（已吊销）→ 透传 409", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(409, { code: "ALREADY_REVOKED", message: "already revoked" })
    );

    const res = await PATCH(makeReq(), params());
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("ALREADY_REVOKED");
  });
});

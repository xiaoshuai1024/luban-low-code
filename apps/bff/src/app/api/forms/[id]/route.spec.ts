import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DELETE } from "./route";
import { signToken } from "@/lib/authToken";

/**
 * forms/[id] DELETE route tests：代理后端 DELETE /forms/{id}，
 * 透传 204 / 409 FORM_HAS_LEADS / 403 / 401。
 */

const token = signToken({ id: "u-1", username: "alice", role: "admin" });

function makeReq(id = "f-1", withToken = true) {
  const headers: Record<string, string> = {};
  if (withToken) headers.authorization = `Bearer ${token}`;
  return new Request(`http://localhost/api/forms/${id}?siteId=s-1`, {
    method: "DELETE",
    headers,
  }) as unknown as import("next/server").NextRequest;
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

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

describe("DELETE /api/forms/:id", () => {
  it("未带 token → 401 UNAUTHENTICATED（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await DELETE(makeReq("f-1", false), params("f-1"));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHENTICATED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("后端 204 → BFF 返回 204 空体，代理到 DELETE /forms/{id}", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendResponse(204));

    const res = await DELETE(makeReq("f-9"), params("f-9"));
    expect(res.status).toBe(204);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(`/forms/f-9?siteId=s-1`);
    expect((init as RequestInit).method).toBe("DELETE");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-User-ID"]).toBe("u-1");
    expect(headers["X-User-Role"]).toBe("admin");
  });

  it("后端 409 FORM_HAS_LEADS → 透传 409 与错误体", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(409, { code: "FORM_HAS_LEADS", message: "表单已有留资数据" })
    );

    const res = await DELETE(makeReq("f-1"), params("f-1"));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      code: "FORM_HAS_LEADS",
      message: "表单已有留资数据",
    });
  });

  it("后端 403 → 透传 403 与错误体", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(403, { code: "PERMISSION_DENIED", message: "forbidden" })
    );

    const res = await DELETE(makeReq("f-1"), params("f-1"));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("PERMISSION_DENIED");
  });
});

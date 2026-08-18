import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";

/**
 * /api/public/ab/assign route tests（e2e AB2/AB3 契约镜像）：
 *   GET ?visitorId=&pageId= → {experimentId,variantId,variantKey,status}（免鉴权，不注入用户头）
 */

function makeReq(qs = "") {
  return new Request(`http://localhost/api/public/ab/assign${qs}`, {
    method: "GET",
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

describe("GET /api/public/ab/assign", () => {
  it("无 token → 直接代理后端（免鉴权，不 401），query 原样透传", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(200, {
        experimentId: "exp-1",
        variantId: "var-A",
        variantKey: "对照组",
        status: "running",
      })
    );

    const res = await GET(makeReq("?visitorId=visitor-1&pageId=page-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.variantId).toBe("var-A");
    expect(body.status).toBe("running");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/public/ab/assign?visitorId=visitor-1&pageId=page-1");
    expect((init as RequestInit).method).toBe("GET");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-User-ID"]).toBeUndefined(); // 公开端点不注入用户身份
  });

  it("ended → 透传 variantId:null + status:ended", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(200, {
        experimentId: "exp-1",
        variantId: null,
        variantKey: null,
        status: "ended",
      })
    );

    const res = await GET(makeReq("?visitorId=v&pageId=page-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.variantId).toBeNull();
    expect(body.status).toBe("ended");
  });

  it("experimentId 直查 query 透传", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(200, { experimentId: "exp-9", variantId: "var-B", variantKey: "变体A", status: "running" })
    );

    await GET(makeReq("?visitorId=v&experimentId=exp-9"));
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/public/ab/assign?visitorId=v&experimentId=exp-9");
  });

  it("后端 404 AB_EXPERIMENT_NOT_FOUND → 透传错误体", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(404, { code: "AB_EXPERIMENT_NOT_FOUND", message: "实验不存在" })
    );

    const res = await GET(makeReq("?visitorId=v&experimentId=nope"));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("AB_EXPERIMENT_NOT_FOUND");
  });
});

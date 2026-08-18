import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";

/**
 * public/feature-gates route tests（公开透传，免鉴权）：
 *   GET /api/public/feature-gates?siteId=&key= → {enabled}
 *   - 不注入身份头（公开资源）
 *   - fail-open 由后端保证，未知 key 后端返回 {enabled:true} 原样透传
 *   - 缺 query → 400（不请求后端）；后端错误原样透传
 */

function makeReq(url = "http://localhost/api/public/feature-gates") {
  return new Request(url) as unknown as import("next/server").NextRequest;
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

describe("GET /api/public/feature-gates", () => {
  it("无 token 也可访问：透传后端 {enabled:false}，不注入身份头", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendResponse(200, { enabled: false }));

    const res = await GET(
      makeReq("http://localhost/api/public/feature-gates?siteId=s-1&key=lead_capture")
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ enabled: false });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/public/feature-gates?siteId=s-1&key=lead_capture");
    expect((init as RequestInit).method).toBe("GET");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-User-ID"]).toBeUndefined();
    expect(headers["X-User-Role"]).toBeUndefined();
  });

  it("未知 key fail-open：后端 {enabled:true} 原样透传（e2e FG4）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendResponse(200, { enabled: true }));

    const res = await GET(
      makeReq("http://localhost/api/public/feature-gates?siteId=s-1&key=non_existent_key")
    );
    expect(res.status).toBe(200);
    expect((await res.json()).enabled).toBe(true);
  });

  it("缺 query 参数 → 400 INVALID_ARGUMENT（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_ARGUMENT");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("后端 5xx → BFF 原样透传 status+code，不静默", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendResponse(503, { code: "INTERNAL", message: "backend error" }));

    const res = await GET(
      makeReq("http://localhost/api/public/feature-gates?siteId=s-1&key=lead_capture")
    );
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("INTERNAL");
  });
});

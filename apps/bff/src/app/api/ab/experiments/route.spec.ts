import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, POST } from "./route";
import { signToken } from "@/lib/authToken";

/**
 * /api/ab/experiments route tests（e2e AB1 契约镜像）：
 *   GET  ?siteId= → {items,total}；POST → 实验对象（顶层 id）
 */

const token = signToken({ id: "u-1", username: "alice", role: "user" });

function makeReq(method: "GET" | "POST", withToken = true, body?: unknown) {
  const headers: Record<string, string> = {};
  if (withToken) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  return new Request("http://localhost/api/ab/experiments", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
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

describe("GET /api/ab/experiments", () => {
  it("未带 token → 401 UNAUTHENTICATED（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await GET(makeReq("GET", false));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHENTICATED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("后端 200 → 透传 {items,total}，siteId query 原样透传 + 注入用户头", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(200, {
        items: [{ id: "exp-1", siteId: "site-1", name: "e", status: "running", variants: [] }],
        total: 1,
      })
    );

    const req = new Request("http://localhost/api/ab/experiments?siteId=site-1", {
      headers: { authorization: `Bearer ${token}` },
    }) as unknown as import("next/server").NextRequest;
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.items[0]).toMatchObject({ id: "exp-1", status: "running" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/ab/experiments?siteId=site-1");
    expect((init as RequestInit).method).toBe("GET");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-User-ID"]).toBe("u-1");
    expect(headers["X-User-Role"]).toBe("user");
  });
});

describe("POST /api/ab/experiments", () => {
  it("未带 token → 401 UNAUTHENTICATED（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await POST(makeReq("POST", false, { siteId: "s", name: "n", variants: [] }));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHENTICATED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("后端 200 → 透传实验对象（顶层 id），e2e 创建契约 body 原样转发", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(200, {
        id: "exp-9",
        siteId: "site-1",
        pageId: "page-1",
        name: "e2e-exp",
        status: "running",
        variants: [
          { id: "var-1", variantKey: "对照组", weight: 50 },
          { id: "var-2", variantKey: "变体A", weight: 50 },
        ],
      })
    );

    const payload = {
      siteId: "site-1",
      pageId: "page-1",
      name: "e2e-exp",
      trafficPct: 100,
      status: "running",
      variants: [
        { label: "对照组", weight: 50, isControl: true },
        { label: "变体A", weight: 50, isControl: false },
      ],
    };
    const res = await POST(makeReq("POST", true, payload));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("exp-9");
    expect(body.variants.length).toBe(2);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/ab/experiments");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(payload);
  });

  it("body 非法 JSON → 400 BAD_REQUEST（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const req = new Request("http://localhost/api/ab/experiments", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: "not-json",
    }) as unknown as import("next/server").NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("BAD_REQUEST");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("后端 404 AB_EXPERIMENT_NOT_FOUND → 透传错误体", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(404, { code: "AB_EXPERIMENT_NOT_FOUND", message: "实验不存在" })
    );

    const res = await POST(makeReq("POST", true, { siteId: "s", name: "n", variants: [{}] }));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("AB_EXPERIMENT_NOT_FOUND");
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";
import { signToken } from "@/lib/authToken";

/**
 * collab 契约路由 tests（对应 e2e collab-contract.spec.ts CC1-CC6）：
 *   401 鉴权（无/无效 token）/ 403 IDOR 越权（他人房间）/ 200 空态（无 WS 服务）
 *   + realtime_collab feature-gates fail-open 容错分支。
 */

const token = signToken({ id: "u-1", username: "alice", role: "user" });

function makeReq(
  siteId = "s-1",
  pageId = "p-1",
  authorization?: string
) {
  const headers: Record<string, string> = {};
  if (authorization !== undefined) headers.authorization = authorization;
  return new Request(`http://localhost/api/collab/${siteId}/${pageId}`, {
    headers,
  }) as unknown as import("next/server").NextRequest;
}

const params = (siteId: string, pageId: string) => ({
  params: Promise.resolve({ siteId, pageId }),
});

function backendResponse(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
    text: async () => JSON.stringify(body ?? {}),
  } as unknown as Response;
}

/** 按 URL 分流的多次后端调用 mock：/sites/{id} 归属判定 + /public/feature-gates gate 读取。 */
function mockBackendRoutes(
  site: { status: number; body?: unknown },
  gate: { status: number; body?: unknown }
) {
  const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
  fetchMock.mockImplementation(async (url: string) => {
    if (url.includes("/public/feature-gates")) {
      return backendResponse(gate.status, gate.body);
    }
    return backendResponse(site.status, site.body);
  });
  return fetchMock;
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/collab/:siteId/:pageId", () => {
  it("CC2: 无 token → 401 UNAUTHENTICATED（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await GET(makeReq(), params("s-1", "p-1"));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHENTICATED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("CC3: 无效 token → 401 UNAUTHENTICATED（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await GET(
      makeReq("s-1", "p-1", "Bearer invalid.token.here"),
      params("s-1", "p-1")
    );
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHENTICATED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("CC1/CC6: 自己 site 的房间 → 200 契约空态（onlineUsers 空、计数 0）", async () => {
    const fetchMock = mockBackendRoutes(
      { status: 200, body: { id: "s-1", ownerUserId: "u-1" } },
      { status: 200, body: { enabled: true } }
    );

    const res = await GET(
      makeReq("s-9", "p-7", `Bearer ${token}`),
      params("s-9", "p-7")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.siteId).toBe("s-9");
    expect(body.pageId).toBe("p-7");
    expect(body.onlineUsers).toEqual([]);
    expect(body.connectionCount).toBe(0);
    expect(body.enabled).toBe(true);

    // 归属判定走后端 GET /sites/{id}，携带鉴权注入头
    const siteCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/sites/s-9")
    );
    expect(siteCall).toBeTruthy();
    const headers = (siteCall![1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(headers["X-User-ID"]).toBe("u-1");
    expect(headers["X-User-Role"]).toBe("user");
  });

  it("CC5: 越权他人 site（后端 403 PERMISSION_DENIED）→ BFF 403，不泄露房间信息", async () => {
    mockBackendRoutes(
      { status: 403, body: { code: "PERMISSION_DENIED", message: "无权查看此站点" } },
      { status: 200, body: { enabled: true } }
    );

    const res = await GET(
      makeReq("s-other", "p-1", `Bearer ${token}`),
      params("s-other", "p-1")
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("FORBIDDEN");
    expect(body.onlineUsers).toBeUndefined();
  });

  it("CC5: site 不存在（后端 404 SITE_NOT_FOUND，伪造 UUID 场景）→ 统一 403", async () => {
    mockBackendRoutes(
      { status: 404, body: { code: "SITE_NOT_FOUND", message: "站点不存在" } },
      { status: 200, body: { enabled: true } }
    );

    const res = await GET(
      makeReq(
        "00000000-0000-0000-0000-000000000000",
        "11111111-1111-1111-1111-111111111111",
        `Bearer ${token}`
      ),
      params(
        "00000000-0000-0000-0000-000000000000",
        "11111111-1111-1111-1111-111111111111"
      )
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FORBIDDEN");
  });

  it("CC4 容错: feature-gates 路由暂缺（后端 404）→ fail-open 仍 200 且 enabled=true", async () => {
    const fetchMock = mockBackendRoutes(
      { status: 200, body: { id: "s-1", ownerUserId: "u-1" } },
      { status: 404, body: { code: "NOT_FOUND", message: "no route" } }
    );

    const res = await GET(
      makeReq("s-1", "p-1", `Bearer ${token}`),
      params("s-1", "p-1")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(true);
    expect(body.onlineUsers).toEqual([]);

    const gateCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/public/feature-gates")
    );
    expect(String(gateCall![0])).toContain("key=realtime_collab");
    expect(String(gateCall![0])).toContain("siteId=s-1");
  });

  it("CC4 容错: feature-gates 后端异常（500）→ fail-open 仍 200 且 enabled=true", async () => {
    mockBackendRoutes(
      { status: 200, body: { id: "s-1", ownerUserId: "u-1" } },
      { status: 500, body: { code: "INTERNAL", message: "boom" } }
    );

    const res = await GET(
      makeReq("s-1", "p-1", `Bearer ${token}`),
      params("s-1", "p-1")
    );
    expect(res.status).toBe(200);
    expect((await res.json()).enabled).toBe(true);
  });

  it("CC4 语义: gate 显式关闭（enabled=false）→ 200 透出 enabled=false（契约层只读取不阻断）", async () => {
    mockBackendRoutes(
      { status: 200, body: { id: "s-1", ownerUserId: "u-1" } },
      { status: 200, body: { enabled: false } }
    );

    const res = await GET(
      makeReq("s-1", "p-1", `Bearer ${token}`),
      params("s-1", "p-1")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(false);
    expect(body.onlineUsers).toEqual([]);
    expect(body.connectionCount).toBe(0);
  });

  it("归属判定自身故障（后端 500）→ 透传 500（toBackendResponse），不吞错", async () => {
    mockBackendRoutes(
      { status: 500, body: { code: "INTERNAL", message: "boom" } },
      { status: 200, body: { enabled: true } }
    );

    const res = await GET(
      makeReq("s-1", "p-1", `Bearer ${token}`),
      params("s-1", "p-1")
    );
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("INTERNAL");
  });
});

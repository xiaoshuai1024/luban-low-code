import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, PUT } from "./route";
import { signToken } from "@/lib/authToken";

/**
 * /api/ai/config 反代契约测试（tasks.md 4.4）：
 * 401（无 token）/ 503（AI_SERVICE_BASE_URL 未配置）/ 反代透传（mock fetch，
 * 断言目标 URL、信任头注入、状态与 body 透传）/ 上游不可达 502 与超时 504。
 */

const AI_BASE = "http://ai-test:8000";
const AI_TOKEN = "ai-shared-token";

const userToken = signToken({ id: "u-1", username: "alice", role: "user" });
const adminToken = signToken({ id: "u-9", username: "root", role: "admin" });

function makeReq(
  method: "GET" | "PUT",
  token: string | null,
  body?: string
): import("next/server").NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/ai/config", {
    method,
    headers,
    body,
  }) as unknown as import("next/server").NextRequest;
}

function upstream(body: unknown, status = 200, contentType = "application/json") {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": contentType },
  });
}

beforeEach(() => {
  vi.stubEnv("AI_SERVICE_BASE_URL", AI_BASE);
  vi.stubEnv("AI_SERVICE_TOKEN", AI_TOKEN);
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/ai/config", () => {
  it("无 token → 401 UNAUTHENTICATED（不触达 AI 服务）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await GET(makeReq("GET", null));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHENTICATED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("AI_SERVICE_BASE_URL 未配置 → 503 AI_SERVICE_UNAVAILABLE（不触达网络）", async () => {
    vi.stubEnv("AI_SERVICE_BASE_URL", "");
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await GET(makeReq("GET", userToken));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("AI_SERVICE_UNAVAILABLE");
    expect(body.code).toBe("AI_SERVICE_UNAVAILABLE");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("AI_SERVICE_BASE_URL 非法（非 http 协议）→ 同样 503", async () => {
    vi.stubEnv("AI_SERVICE_BASE_URL", "ftp://ai:8000");
    const res = await GET(makeReq("GET", userToken));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("AI_SERVICE_UNAVAILABLE");
  });

  it("反代透传：目标 /ai/config、注入信任头、状态与 body 原样返回", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const cfg = {
      model: { provider: "glm", name: "glm-4" },
      features: { generate: true, guidance: true },
    };
    fetchMock.mockResolvedValue(upstream(cfg));

    const res = await GET(makeReq("GET", userToken));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(cfg);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    // SSRF 契约：目标只能是 env 配置 origin + 固定路径
    expect(String(url)).toBe(`${AI_BASE}/ai/config`);
    expect((init as RequestInit).method).toBe("GET");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-User-Id"]).toBe("u-1");
    expect(headers["X-User-Role"]).toBe("user");
    expect(headers["X-Luban-Role"]).toBe("user");
    expect(headers["X-Internal-Token"]).toBe(AI_TOKEN);
    expect(headers["Accept"]).toBe("application/json");
  });

  it("admin token → 角色头注入 admin", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(upstream({}));
    await GET(makeReq("GET", adminToken));
    const headers = (fetchMock.mock.calls[0][1] as RequestInit)
      .headers as Record<string, string>;
    expect(headers["X-Luban-Role"]).toBe("admin");
    expect(headers["X-User-Role"]).toBe("admin");
  });

  it("上游网络失败（ECONNREFUSED 等）→ 502 AI_UPSTREAM_UNAVAILABLE", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValue(
      Object.assign(new TypeError("fetch failed"), { cause: new Error("ECONNREFUSED") })
    );
    const res = await GET(makeReq("GET", userToken));
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe("AI_UPSTREAM_UNAVAILABLE");
  });

  it("上游超时 → 504 AI_UPSTREAM_TIMEOUT", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    const res = await GET(makeReq("GET", userToken));
    expect(res.status).toBe(504);
    expect((await res.json()).code).toBe("AI_UPSTREAM_TIMEOUT");
  });

  it("上游 4xx 错误体透传（不吞错、不改状态码）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      upstream({ code: "PERMISSION_DENIED", message: "forbidden" }, 403)
    );
    const res = await GET(makeReq("GET", userToken));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("PERMISSION_DENIED");
  });
});

describe("PUT /api/ai/config", () => {
  it("无 token → 401（不触达 AI 服务）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await PUT(makeReq("PUT", null, "{}"));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("未配置 AI_SERVICE_BASE_URL → 503", async () => {
    vi.stubEnv("AI_SERVICE_BASE_URL", "");
    const res = await PUT(makeReq("PUT", userToken, "{}"));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("AI_SERVICE_UNAVAILABLE");
  });

  it("provider 切换：body 原样转发，响应透传", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      upstream({ model: { provider: "deepseek", name: "deepseek-chat" } })
    );
    const newCfg = JSON.stringify({
      model: { provider: "deepseek", name: "deepseek-chat" },
    });

    const res = await PUT(makeReq("PUT", userToken, newCfg));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      model: { provider: "deepseek", name: "deepseek-chat" },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${AI_BASE}/ai/config`);
    expect((init as RequestInit).method).toBe("PUT");
    expect((init as RequestInit).body).toBe(newCfg);
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-Internal-Token"]).toBe(AI_TOKEN);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { signToken } from "@/lib/authToken";

/**
 * /api/ai/chat 反代契约测试（tasks.md 4.4 visitor 分支）：
 * - 无 token（visitor）→ 转发体 tools 强制 []（调用方传入也被覆盖），
 *   角色头注入 visitor；
 * - 有 token（user）→ body 原样转发（不清 tools）；
 * - 非 JSON body → 400；未配置 AI 服务 → 503；SSE 流原样透传。
 */

const AI_BASE = "http://ai-test:8000";
const AI_TOKEN = "ai-shared-token";

const userToken = signToken({ id: "u-1", username: "alice", role: "user" });

function makeReq(
  token: string | null,
  body: unknown
): import("next/server").NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/ai/chat", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

function sseUpstream(status = 200) {
  return new Response('data: {"type":"done","status":"idle"}\n\n', {
    status,
    headers: { "content-type": "text/event-stream" },
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

describe("POST /api/ai/chat", () => {
  it("无 token → visitor：转发体 tools 强制 []（覆盖调用方传入），角色头 visitor", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(sseUpstream());

    const res = await POST(
      makeReq(null, {
        message: "这个产品怎么预约",
        tools: [{ name: "patch_page" }, { name: "read_schema" }],
      })
    );
    expect(res.status).toBe(200);
    await res.text(); // 消费流

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${AI_BASE}/ai/chat`);
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-Luban-Role"]).toBe("visitor");
    expect(headers["X-User-Role"]).toBe("visitor");
    expect(headers["X-User-Id"]).toBe("visitor");
    expect(headers["X-Internal-Token"]).toBe(AI_TOKEN);
    // 核心契约：visitor 禁工具调用 —— tools 被覆盖为空数组
    const forwarded = JSON.parse((init as RequestInit).body as string);
    expect(forwarded.tools).toEqual([]);
    expect(forwarded.message).toBe("这个产品怎么预约");
  });

  it("visitor 即使不带 tools 字段，转发体也补 tools=[]", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(sseUpstream());

    await POST(makeReq(null, { message: "hi" }));
    const forwarded = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string
    );
    expect(forwarded.tools).toEqual([]);
  });

  it("有 token（user）→ body 原样转发（tools 不清空），角色头 user", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(sseUpstream());

    const reqBody = {
      message: "做一个用户列表页",
      siteId: "s-1",
      tools: [{ name: "patch_page" }],
    };
    await POST(makeReq(userToken, reqBody));

    const headers = (fetchMock.mock.calls[0][1] as RequestInit)
      .headers as Record<string, string>;
    expect(headers["X-Luban-Role"]).toBe("user");
    expect(headers["X-User-Id"]).toBe("u-1");
    const forwarded = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string
    );
    expect(forwarded).toEqual(reqBody);
  });

  it("非 JSON body → 400 INVALID_ARGUMENT（不触达 AI 服务）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await POST(makeReq(userToken, "not-json{"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_ARGUMENT");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("未配置 AI_SERVICE_BASE_URL → 503 AI_SERVICE_UNAVAILABLE", async () => {
    vi.stubEnv("AI_SERVICE_BASE_URL", "");
    const res = await POST(makeReq(null, { message: "hi" }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("AI_SERVICE_UNAVAILABLE");
  });

  it("SSE 流原样透传（content-type 与事件帧不变）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(sseUpstream());

    const res = await POST(makeReq(userToken, { message: "hi" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(await res.text()).toContain('"type":"done"');
  });

  it("上游网络失败 → 502（访客链路同样不静默）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const res = await POST(makeReq(null, { message: "hi" }));
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe("AI_UPSTREAM_UNAVAILABLE");
  });
});

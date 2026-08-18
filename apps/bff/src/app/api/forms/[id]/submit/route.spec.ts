import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";

/**
 * forms/[id]/submit route tests：公开留资提交。
 * 回归锁（安全）：XFF 必须取末段（nginx 追加真实客户端 IP，前段可伪造）；
 * 非对象 JSON body（number/string/array）必须 400 INVALID_ARGUMENT 而非 500。
 */

const params = () => ({ params: Promise.resolve({ id: "f-1" }) });

function makeReq(rawBody: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/forms/f-1/submit", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: rawBody,
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

describe("POST /api/forms/:id/submit — body 校验", () => {
  it.each([
    ["数字", "123"],
    ["字符串", '"give me a 500"'],
    ["数组", '["contact"]'],
    ["null", "null"],
    ["坏 JSON", "not-json"],
  ])("%s → 400，不请求后端", async (_label, rawBody) => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await POST(makeReq(rawBody), params());
    expect(res.status).toBe(400);
    const body = await res.json();
    // 坏 JSON 保持既有 BAD_REQUEST；合法 JSON 但非对象 → INVALID_ARGUMENT
    expect(["BAD_REQUEST", "INVALID_ARGUMENT"]).toContain(body.code);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("非对象合法 JSON → 400 INVALID_ARGUMENT（回归：原实现 body.formId 注入 TypeError → 500）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await POST(makeReq("123"), params());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_ARGUMENT");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/forms/:id/submit — XFF 取末段", () => {
  it("多段 XFF → 只透传末段真实 IP（前段伪造不计入防刷）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendResponse(200, { status: "OK", dedup: false }));

    const res = await POST(
      makeReq(JSON.stringify({ contact: "b@x.com" }), {
        "x-forwarded-for": "1.2.3.4, 10.0.0.1, 203.0.113.9",
        "x-visitor-id": "v-77",
      }),
      params()
    );
    expect(res.status).toBe(200);

    const [, init] = fetchMock.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-Forwarded-For"]).toBe("203.0.113.9");
    expect(headers["X-Visitor-ID"]).toBe("v-77");
  });

  it("单段 XFF → 原样透传", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendResponse(200, { status: "OK", dedup: false }));

    await POST(
      makeReq(JSON.stringify({ contact: "b@x.com" }), {
        "x-forwarded-for": "198.51.100.7",
      }),
      params()
    );

    const [, init] = fetchMock.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-Forwarded-For"]).toBe("198.51.100.7");
  });

  it("无 XFF → 空串透传（后端自行回退 remoteAddr）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendResponse(200, { status: "OK", dedup: false }));

    await POST(makeReq(JSON.stringify({ contact: "b@x.com" })), params());

    const [, init] = fetchMock.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-Forwarded-For"]).toBe("");
  });
});

describe("POST /api/forms/:id/submit — 成功/错误透传", () => {
  it("后端 200 → 透传结果且剥离 leadId（不向访客暴露内部 UUID）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(200, { leadId: "uuid-internal", status: "OK", dedup: false })
    );

    const res = await POST(makeReq(JSON.stringify({ contact: "b@x.com" })), params());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "OK", dedup: false });
    expect("leadId" in body).toBe(false);

    // formId 由 path 注入（后端 @NotBlank）
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse((init as RequestInit).body as string).formId).toBe("f-1");
  });

  it("后端 429 LEAD_SPAM_BLOCKED → 透传 429", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(429, { code: "LEAD_SPAM_BLOCKED", message: "提交过于频繁" })
    );

    const res = await POST(makeReq(JSON.stringify({ contact: "b@x.com" })), params());
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("LEAD_SPAM_BLOCKED");
  });

  it("后端 409 LEAD_DUPLICATE → 透传 409", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(409, { code: "LEAD_DUPLICATE", message: "重复提交" })
    );

    const res = await POST(makeReq(JSON.stringify({ contact: "b@x.com" })), params());
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("LEAD_DUPLICATE");
  });
});

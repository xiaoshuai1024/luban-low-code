import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { callBackend, BackendHttpError } from "@/lib/backendClient";

// backendClient.ts 在模块加载时读取 BACKEND_BASE_URL，因此这里捕获真实生效值，
// 而不是去覆盖一个已被冻结到模块作用域的常量。
const BASE_URL =
  process.env.BACKEND_BASE_URL || "http://127.0.0.1:8080/backend";

function jsonResponse(body: unknown, status = 200, contentType = "application/json") {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": contentType }),
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as unknown as Response;
}

describe("callBackend", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("透传自定义 headers（X-User-ID/X-User-Role）且注入 Content-Type", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await callBackend("/users", {
      method: "GET",
      headers: {
        "X-User-ID": "u-1",
        "X-User-Role": "admin",
      },
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/users`);
    expect(init).toMatchObject({ method: "GET" });
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-User-ID"]).toBe("u-1");
    expect(headers["X-User-Role"]).toBe("admin");
    // 默认 Content-Type 注入
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("成功（JSON）→ 解析并返回 body", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(jsonResponse({ id: "u-9", name: "x" }));

    const res = await callBackend<{ id: string; name: string }>("/users/u-9");
    expect(res).toEqual({ id: "u-9", name: "x" });
  });

  it("成功（text/plain，但内容是 JSON）→ 走 text 分支并解析", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      jsonResponse({ id: "u-9" }, 200, "text/plain")
    );

    const res = await callBackend<{ id: string }>("/users/u-9");
    expect(res).toEqual({ id: "u-9" });
  });

  it("4xx 错误带 code/message → 抛 BackendHttpError 映射 status/code", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      jsonResponse(
        { code: "PERMISSION_DENIED", message: "无权限", details: { a: 1 } },
        403
      )
    );

    await expect(callBackend("/users")).rejects.toSatisfy((err: unknown) => {
      const e = err as BackendHttpError;
      return (
        e instanceof BackendHttpError &&
        e.status === 403 &&
        e.code === "PERMISSION_DENIED" &&
        e.message === "无权限" &&
        e.details !== undefined &&
        (e.details as { a: number }).a === 1
      );
    });
  });

  it("5xx 错误且 body 非 JSON（parse 失败）→ code 回退 INTERNAL，message 回退", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    // res.json() 抛错模拟非 JSON body
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "text/html" }),
      json: async () => {
        throw new Error("not json");
      },
      text: async () => "<html>err</html>",
    } as unknown as Response);

    try {
      await callBackend("/users");
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(BackendHttpError);
      const e = err as BackendHttpError;
      expect(e.status).toBe(500);
      expect(e.code).toBe("INTERNAL");
      expect(e.message).toBe("Backend error 500");
    }
  });

  it("BackendHttpError 实例字段可独立访问", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      jsonResponse({ code: "NOT_FOUND", message: "missing" }, 404)
    );

    try {
      await callBackend("/users/missing");
      throw new Error("should have thrown");
    } catch (err) {
      const e = err as BackendHttpError;
      expect(e).toBeInstanceOf(BackendHttpError);
      expect(e).toBeInstanceOf(Error);
      expect(e.status).toBe(404);
      expect(e.code).toBe("NOT_FOUND");
      expect(e.message).toBe("missing");
    }
  });
});

describe("callBackend X-Internal-Auth 注入", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    delete process.env.INTERNAL_AUTH_SECRET;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("配置 INTERNAL_AUTH_SECRET → 注入该头，且覆盖调用方传入的伪造值", async () => {
    process.env.INTERNAL_AUTH_SECRET = "secret-abc";
    vi.resetModules();
    const { callBackend } = await import("@/lib/backendClient");

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await callBackend("/users", {
      method: "GET",
      headers: { "X-Internal-Auth": "forged-by-caller" },
    });

    const [, init] = fetchMock.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-Internal-Auth"]).toBe("secret-abc");
  });

  it("未配置 → 不注入，调用方传入的 X-Internal-Auth 被剥离（不透传伪造值），且只 WARN 一次", async () => {
    delete process.env.INTERNAL_AUTH_SECRET;
    vi.resetModules();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { callBackend } = await import("@/lib/backendClient");

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await callBackend("/users", {
      method: "GET",
      headers: { "X-Internal-Auth": "forged-by-caller" },
    });
    await callBackend("/users", { method: "GET" });

    const headers = (fetchMock.mock.calls[0][1] as RequestInit)
      .headers as Record<string, string>;
    expect(headers["X-Internal-Auth"]).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

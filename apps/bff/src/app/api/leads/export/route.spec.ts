import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";
import { signToken } from "@/lib/authToken";

/**
 * leads/export route tests：CSV 流透传（callBackendRaw：不走 JSON 解析，
 * 但保留超时/头注入/BackendHttpError 错误契约）。
 */

const token = signToken({ id: "u-1", username: "alice", role: "user" });

function makeReq(withToken = true) {
  const headers: Record<string, string> = {};
  if (withToken) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/leads/export?siteId=s-1", {
    method: "GET",
    headers,
  }) as unknown as import("next/server").NextRequest;
}

function backendCsvResponse(csv: string) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "text/csv" }),
    json: async () => {
      throw new Error("not json");
    },
    text: async () => csv,
  } as unknown as Response;
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

describe("GET /api/leads/export", () => {
  it("未带 token → 401（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await GET(makeReq(false));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("后端 200 CSV → BFF 200 透传 CSV + 下载头 + 超时信号", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(backendCsvResponse("name,contact\nbob,b@x.com\n"));

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("leads.csv");
    expect(await res.text()).toBe("name,contact\nbob,b@x.com\n");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/leads/export?siteId=s-1");
    // 经 callBackendRaw：必须有超时信号（原裸 fetch 无超时的回归锁）
    expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal);
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-User-ID"]).toBe("u-1");
  });

  it("后端 403 → 透传 403 与后端错误体（原实现手工解析错误体，现走 BackendHttpError）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(403, { code: "PERMISSION_DENIED", message: "无权导出" })
    );

    const res = await GET(makeReq());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("PERMISSION_DENIED");
    expect(body.message).toBe("无权导出");
  });

  it("后端 500 非 JSON 错误体 → code 回退 INTERNAL", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "text/html" }),
      json: async () => {
        throw new Error("not json");
      },
      text: async () => "<html>err</html>",
    } as unknown as Response);

    const res = await GET(makeReq());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("INTERNAL");
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";
import { signToken } from "@/lib/authToken";

/**
 * sites/slug-check route tests：透传 Java GET /sites/slug-check
 * （200 available=true / 409 SLUG_TAKEN，静态段优先于 [siteId] 动态段）。
 */

const token = signToken({ id: "u-1", username: "alice", role: "user" });

function makeReq(slug = "my-site", withToken = true) {
  const headers: Record<string, string> = {};
  if (withToken) headers.authorization = `Bearer ${token}`;
  const qs = slug ? `?slug=${encodeURIComponent(slug)}` : "";
  return new Request(`http://localhost/api/sites/slug-check${qs}`, {
    headers,
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

describe("GET /api/sites/slug-check", () => {
  it("未带 token → 401 UNAUTHENTICATED（不请求后端）", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await GET(makeReq("my-site", false));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHENTICATED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("后端 200 → BFF 200 透传 {available,slug}，slug query 原样透传", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(200, { available: true, slug: "my-site" })
    );

    const res = await GET(makeReq("my-site"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ available: true, slug: "my-site" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/sites/slug-check?slug=my-site");
    expect((init as RequestInit).method).toBe("GET");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-User-ID"]).toBe("u-1");
  });

  it("后端 409 SLUG_TAKEN → 透传 409 与错误体", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      backendResponse(409, {
        code: "SLUG_TAKEN",
        message: "站点地址已被占用",
        details: { slug: "my-site" },
      })
    );

    const res = await GET(makeReq("my-site"));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("SLUG_TAKEN");
    expect(body.details).toEqual({ slug: "my-site" });
  });
});

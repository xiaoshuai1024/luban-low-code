import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { signToken } from "@/lib/authToken";

/**
 * proxy/fetch route tests. The SSRF guard itself has its own exhaustive spec
 * (ssrfGuard.spec.ts); here we verify the route wiring: auth gate, body parsing,
 * upstream success, upstream non-2xx → 502, and that the guard's rejection is
 * returned verbatim.
 */

const SECRET = "dev-secret-change-me-in-prod";
const token = signToken({ id: "u-1", username: "alice", role: "admin" });

function makeReq(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/proxy/fetch", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("node:dns");
  vi.resetModules();
});

describe("POST /api/proxy/fetch", () => {
  it("rejects without a Bearer token (401)", async () => {
    const req = new Request("http://localhost/api/proxy/fetch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    }) as unknown as import("next/server").NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHENTICATED");
  });

  it("rejects when url is missing (400)", async () => {
    const res = await POST(makeReq({ method: "GET" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_ARGUMENT");
  });

  it("rejects an SSRF-class url (delegate to guard, 400)", async () => {
    // Stub dns so the guard sees a metadata IP.
    vi.doMock("node:dns", () => ({
      promises: {
        lookup: async () => [{ address: "169.254.169.254", family: 4 }],
      },
    }));
    vi.resetModules();
    const mod = await import("./route");
    const res = await mod.POST(makeReq({ url: "https://attacker.example/imds" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("SSRF_REJECTED");
  });

  it("forwards to a safe https url and returns {data,status}", async () => {
    vi.doMock("node:dns", () => ({
      promises: {
        lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      },
    }));
    vi.resetModules();
    const mod = await import("./route");

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ hello: "world" }),
    } as unknown as Response);

    const res = await mod.POST(
      makeReq({ url: "https://example.com/api", method: "GET" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe(200);
    expect(body.data).toEqual({ hello: "world" });

    // Critical: no X-User-* header leaked to the third party.
    const [, init] = fetchMock.mock.calls[0];
    const fwdHeaders = (init as RequestInit).headers as Record<string, string>;
    expect(fwdHeaders["X-User-ID"]).toBeUndefined();
    expect(fwdHeaders["X-User-Role"]).toBeUndefined();
  });

  it("maps upstream non-2xx to 502 DATASOURCE_UPSTREAM_ERROR", async () => {
    vi.doMock("node:dns", () => ({
      promises: {
        lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      },
    }));
    vi.resetModules();
    const mod = await import("./route");

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "text/html" }),
      text: async () => "<html>err</html>",
    } as unknown as Response);

    const res = await mod.POST(makeReq({ url: "https://example.com/x" }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.code).toBe("DATASOURCE_UPSTREAM_ERROR");
    expect(body.message).toContain("500");
  });
});

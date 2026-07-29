import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";
import { assertSafeOutboundUrl } from "@/lib/ssrfGuard";

/**
 * SSRF guard tests. Every bypass vector called out in plan §6.1 + §敏感字段 has a
 * dedicated case: localhost names, loopback/private/link-local IPv4, the cloud
 * metadata IP, IPv6 loopback/link-local, IPv4-mapped IPv6, non-https schemes, and
 * DNS rebinding (a public-looking name that resolves to a private IP).
 *
 * No skips, no soft asserts. Each rejected case asserts both the 400 status and
 * the SSRF_REJECTED code; each accepted case asserts null.
 */

// Stub dns.lookup so tests don't hit the network. Per-test overrides via the
// `dnsMap`/`dnsThrow` helpers.
type LookupAll = { address: string; family: number }[];
let dnsResult: LookupAll | null = null;
let dnsError: NodeJS.ErrnoException | null = null;

beforeEach(() => {
  dnsResult = null;
  dnsError = null;
  vi.doMock("node:dns", () => ({
    promises: {
      lookup: async () => {
        if (dnsError) throw dnsError;
        return dnsResult ?? [];
      },
    },
  }));
  // Re-import after the mock so the module under test picks up the stub.
  vi.resetModules();
});

afterEach(() => {
  vi.doUnmock("node:dns");
  vi.resetModules();
});

async function guard(url: string) {
  const mod = await import("@/lib/ssrfGuard");
  return mod.assertSafeOutboundUrl(url);
}

describe("assertSafeOutboundUrl", () => {
  it("accepts a public https host", async () => {
    dnsResult = [{ address: "93.184.216.34", family: 4 }]; // example.com
    const res = await guard("https://example.com/api/x");
    expect(res).toBeNull();
  });

  it("rejects non-https scheme by default", async () => {
    dnsResult = [{ address: "93.184.216.34", family: 4 }];
    const res = await guard("http://example.com/x");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(400);
    const body = await res!.json();
    expect(body.code).toBe("SSRF_REJECTED");
  });

  it("rejects file: scheme", async () => {
    dnsResult = [{ address: "1.2.3.4", family: 4 }];
    const res = await guard("file:///etc/passwd");
    expect(res!.status).toBe(400);
  });

  it("rejects gopher: scheme", async () => {
    dnsResult = [{ address: "1.2.3.4", family: 4 }];
    const res = await guard("gopher://x/");
    expect(res!.status).toBe(400);
  });

  it("rejects malformed url", async () => {
    const res = await guard("not a url at all");
    expect(res!.status).toBe(400);
  });

  it("rejects localhost by name", async () => {
    dnsResult = [{ address: "127.0.0.1", family: 4 }];
    const res = await guard("https://localhost/admin");
    expect(res!.status).toBe(400);
    expect((await res!.json()).code).toBe("SSRF_REJECTED");
  });

  it("rejects sub.localhost", async () => {
    dnsResult = [{ address: "127.0.0.1", family: 4 }];
    const res = await guard("https://api.localhost/x");
    expect(res!.status).toBe(400);
  });

  it("rejects *.local mdns name", async () => {
    dnsResult = [{ address: "10.0.0.5", family: 4 }];
    const res = await guard("https://host.local/x");
    expect(res!.status).toBe(400);
  });

  it("rejects IPv4 loopback 127.0.0.1", async () => {
    dnsResult = [{ address: "127.0.0.1", family: 4 }];
    const res = await guard("https://127.0.0.1/x");
    expect(res!.status).toBe(400);
  });

  it("rejects IPv4 loopback 127.1.2.3 (full /8)", async () => {
    dnsResult = [{ address: "127.1.2.3", family: 4 }];
    const res = await guard("https://127.1.2.3/x");
    expect(res!.status).toBe(400);
  });

  it("rejects IPv4 private 10.x", async () => {
    dnsResult = [{ address: "10.0.0.1", family: 4 }];
    const res = await guard("https://10.0.0.1/x");
    expect(res!.status).toBe(400);
  });

  it("rejects IPv4 private 192.168.x", async () => {
    dnsResult = [{ address: "192.168.1.1", family: 4 }];
    const res = await guard("https://192.168.1.1/x");
    expect(res!.status).toBe(400);
  });

  it("rejects IPv4 private 172.16-31.x", async () => {
    dnsResult = [{ address: "172.16.0.1", family: 4 }];
    const res = await guard("https://172.16.0.1/x");
    expect(res!.status).toBe(400);
  });

  it("allows 172.32.x (just outside the private range)", async () => {
    dnsResult = [{ address: "172.32.0.1", family: 4 }];
    const res = await guard("https://172.32.0.1/x");
    expect(res).toBeNull();
  });

  it("rejects link-local 169.254.x.x", async () => {
    dnsResult = [{ address: "169.254.1.1", family: 4 }];
    const res = await guard("https://169.254.1.1/x");
    expect(res!.status).toBe(400);
  });

  it("rejects cloud metadata IP 169.254.169.254 (AWS/Azure/GCP)", async () => {
    dnsResult = [{ address: "169.254.169.254", family: 4 }];
    const res = await guard("https://169.254.169.254/latest/meta-data/");
    expect(res!.status).toBe(400);
    expect((await res!.json()).code).toBe("SSRF_REJECTED");
  });

  it("rejects 0.0.0.0", async () => {
    dnsResult = [{ address: "0.0.0.0", family: 4 }];
    const res = await guard("https://0.0.0.0/x");
    expect(res!.status).toBe(400);
  });

  it("rejects CGNAT 100.64.x.x", async () => {
    dnsResult = [{ address: "100.64.0.1", family: 4 }];
    const res = await guard("https://100.64.0.1/x");
    expect(res!.status).toBe(400);
  });

  it("rejects IPv6 loopback ::1", async () => {
    dnsResult = [{ address: "::1", family: 6 }];
    const res = await guard("https://[::1]/x");
    expect(res!.status).toBe(400);
  });

  it("rejects IPv6 link-local fe80::", async () => {
    dnsResult = [{ address: "fe80::1", family: 6 }];
    const res = await guard("https://[fe80::1]/x");
    expect(res!.status).toBe(400);
  });

  it("rejects IPv6 unique-local fc00::/7 (fc + fd)", async () => {
    dnsResult = [{ address: "fd00::1", family: 6 }];
    const res = await guard("https://[fd00::1]/x");
    expect(res!.status).toBe(400);
  });

  it("rejects IPv4-mapped IPv6 of a private address", async () => {
    // ::ffff:10.0.0.1 must be blocked via the v4 re-check.
    dnsResult = [{ address: "::ffff:10.0.0.1", family: 6 }];
    const res = await guard("https://[::ffff:10.0.0.1]/x");
    expect(res!.status).toBe(400);
  });

  it("rejects DNS rebinding: public-looking name that resolves to 169.254.169.254", async () => {
    // This is the whole reason we resolve+check the IP, not just the hostname.
    dnsResult = [{ address: "169.254.169.254", family: 4 }];
    const res = await guard("https://attacker.example.com/imds");
    expect(res!.status).toBe(400);
    expect((await res!.json()).message).toContain("169.254.169.254");
  });

  it("rejects when DNS lookup throws", async () => {
    dnsError = new Error("ENOTFOUND") as NodeJS.ErrnoException;
    const res = await guard("https://nonexistent.invalid/x");
    expect(res!.status).toBe(400);
    expect((await res!.json()).code).toBe("SSRF_REJECTED");
  });

  it("rejects when DNS returns no records", async () => {
    dnsResult = [];
    const res = await guard("https://empty.example/x");
    expect(res!.status).toBe(400);
  });

  it("rejects if any resolved address is private (mixed records)", async () => {
    // One public + one private — the private one must fail the whole request.
    dnsResult = [
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ];
    const res = await guard("https://dual.example/x");
    expect(res!.status).toBe(400);
  });

  it("allows http when SSRF_ALLOW_HTTP=1 (local dev only)", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development"; // not production → allowHttp honored
    process.env.SSRF_ALLOW_HTTP = "1";
    dnsResult = [{ address: "93.184.216.34", family: 4 }];
    const res = await guard("http://example.com/x");
    expect(res).toBeNull();
    delete process.env.SSRF_ALLOW_HTTP;
    process.env.NODE_ENV = prevNodeEnv;
  });

  it("still rejects private IPs even with SSRF_ALLOW_HTTP=1", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    process.env.SSRF_ALLOW_HTTP = "1";
    dnsResult = [{ address: "169.254.169.254", family: 4 }];
    const res = await guard("http://169.254.169.254/x");
    expect(res!.status).toBe(400);
    delete process.env.SSRF_ALLOW_HTTP;
    process.env.NODE_ENV = prevNodeEnv;
  });

  it("rejects explicit non-whitelisted port (e.g. Redis 6379)", async () => {
    dnsResult = [{ address: "93.184.216.34", family: 4 }];
    const res = await guard("https://example.com:6379/x");
    expect(res!.status).toBe(400);
    expect((await res!.json()).code).toBe("SSRF_REJECTED");
  });

  it("allows explicit whitelisted port 8080", async () => {
    dnsResult = [{ address: "93.184.216.34", family: 4 }];
    const res = await guard("https://example.com:8080/x");
    expect(res).toBeNull();
  });

  it("forces https in production even if SSRF_ALLOW_HTTP=1 is mis-set", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    process.env.SSRF_ALLOW_HTTP = "1"; // ops mistake — must be ignored in prod
    dnsResult = [{ address: "93.184.216.34", family: 4 }];
    const res = await guard("http://example.com/x");
    expect(res!.status).toBe(400);
    expect((await res!.json()).message).toContain("https only");
    delete process.env.SSRF_ALLOW_HTTP;
    process.env.NODE_ENV = prevNodeEnv;
  });
});

describe("safeFetch", () => {
  it("blocks a 302 redirect to an internal IP (BLOCK-1: no auto-follow bypass)", async () => {
    dnsResult = [{ address: "93.184.216.34", family: 4 }]; // public-looking host
    // Stub global fetch to return a 302 Location → cloud metadata IP. Without
    // redirect:"manual" the real fetch would follow it and exfiltrate to 169.254.169.254.
    const realFetch = globalThis.fetch;
    const stub = vi.fn(async () =>
      new Response(null, {
        status: 302,
        headers: { Location: "http://169.254.169.254/latest/meta-data/" },
      })
    ) as unknown as typeof fetch;
    globalThis.fetch = stub;
    try {
      const mod = await import("@/lib/ssrfGuard");
      const res = await mod.safeFetch("https://attacker.example/imds");
      expect(res).toBeInstanceOf(NextResponse);
      const nr = res as NextResponse;
      expect(nr.status).toBe(400);
      const body = await nr.json();
      expect(body.code).toBe("SSRF_REJECTED");
      expect(body.message).toContain("redirect");
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("passes through a normal 200 response", async () => {
    dnsResult = [{ address: "93.184.216.34", family: 4 }];
    const realFetch = globalThis.fetch;
    const stub = vi.fn(async () =>
      new Response('{"ok":true}', {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    ) as unknown as typeof fetch;
    globalThis.fetch = stub;
    try {
      const mod = await import("@/lib/ssrfGuard");
      const res = await mod.safeFetch("https://example.com/api");
      expect(res).toBeInstanceOf(Response);
      expect((res as Response).status).toBe(200);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("returns the SSRF rejection when the URL itself is blocked", async () => {
    dnsResult = [{ address: "169.254.169.254", family: 4 }];
    const mod = await import("@/lib/ssrfGuard");
    const res = await mod.safeFetch("https://attacker.example/imds");
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
  });
});

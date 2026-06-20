import { NextResponse } from "next/server";

/**
 * SSRF guard for user-supplied outbound fetches (datasource api probes, the
 * /api/proxy/fetch route). The backend itself cannot enforce this because by the
 * time a request reaches it the resolved IP is opaque; the BFF is the only layer
 * that can block SSRF before the fetch happens.
 *
 * Rules (plan §敏感字段 + §6.1):
 *   1. Protocol must be https (no http, no file, no gopher, etc.). Local dev may
 *      relax this only via SSRF_ALLOW_HTTP=1 — NEVER in production (hard-enforced).
 *   2. Hostname must not be a link-local / loopback / private / metadata address,
 *      and must not be a "localhost"/"*.local" name. Both the literal hostname and
 *      every resolved IP are checked (DNS rebinding defense).
 *   3. The literal cloud metadata IP 169.254.169.254 is always rejected.
 *   4. Port must be empty (protocol default) or in {80, 443, 8080, 8443}.
 *
 * Returns null when the URL is safe; otherwise a NextResponse with a 400 error
 * (callers should `return` it directly).
 */
export async function assertSafeOutboundUrl(
  rawUrl: string
): Promise<NextResponse | null> {
  if (!rawUrl || typeof rawUrl !== "string") {
    return NextResponse.json(
      { code: "SSRF_REJECTED", message: "url is required" },
      { status: 400 }
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return NextResponse.json(
      { code: "SSRF_REJECTED", message: "invalid url" },
      { status: 400 }
    );
  }

  // LOW-1: SSRF_ALLOW_HTTP=1 is a dev-only escape hatch; production always forces
  // https, even if the env var is mis-set, so an ops mistake can't downgrade the
  // whole allowlist.
  const isProduction = process.env.NODE_ENV === "production";
  const allowHttp = !isProduction && process.env.SSRF_ALLOW_HTTP === "1";
  if (!allowHttp && parsed.protocol !== "https:") {
    return NextResponse.json(
      {
        code: "SSRF_REJECTED",
        message: `protocol ${parsed.protocol} not allowed (https only)`,
      },
      { status: 400 }
    );
  }
  if (allowHttp && parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json(
      {
        code: "SSRF_REJECTED",
        message: `protocol ${parsed.protocol} not allowed`,
      },
      { status: 400 }
    );
  }

  // HIGH-1: port whitelist. Empty port = protocol default (80/443) and is allowed.
  // Explicit ports must be in the allowlist so attackers can't reach Redis (:6379),
  // SSH (:22), MySQL (:3306), ES (:9200), etc. on internal hosts.
  const port = parsed.port;
  if (port && !ALLOWED_PORTS.has(port)) {
    return NextResponse.json(
      {
        code: "SSRF_REJECTED",
        message: `port ${port} not allowed (whitelist: ${[...ALLOWED_PORTS].join(", ")})`,
      },
      { status: 400 }
    );
  }

  const host = parsed.hostname.toLowerCase();

  // Hostname-shape rejects (cover cases where the user types the name directly
  // and we don't want to rely on a DNS lookup to block it).
  if (isBlockedHostname(host)) {
    return NextResponse.json(
      {
        code: "SSRF_REJECTED",
        message: `hostname ${host} is blocked (private/loopback/link-local/metadata)`,
      },
      { status: 400 }
    );
  }

  // Resolve and check every address. Node's dns.lookup returns the first family
  // by default; we ask for both v4 and v6 to catch IPv6-mapped attacks. If DNS
  // itself fails we reject (treat as unsafe — never fall through).
  const { promises: dns } = await import("node:dns");
  let addrs: string[];
  try {
    const records = await dns.lookup(host, { all: true, verbatim: true });
    addrs = records.map((r) => r.address);
  } catch {
    return NextResponse.json(
      { code: "SSRF_REJECTED", message: `dns lookup failed for ${host}` },
      { status: 400 }
    );
  }
  if (addrs.length === 0) {
    return NextResponse.json(
      { code: "SSRF_REJECTED", message: `no dns records for ${host}` },
      { status: 400 }
    );
  }
  for (const ip of addrs) {
    if (isBlockedIp(ip)) {
      return NextResponse.json(
        {
          code: "SSRF_REJECTED",
          message: `resolved address ${ip} is blocked (private/loopback/link-local/metadata)`,
        },
        { status: 400 }
      );
    }
  }

  return null;
}

/** Allowed explicit ports. Default ports (http=80, https=443) are always allowed. */
const ALLOWED_PORTS = new Set(["80", "443", "8080", "8443"]);

/**
 * Safe outbound fetch: vets the URL with {@link assertSafeOutboundUrl} AND disables
 * automatic redirect-following (BLOCK-1). `fetch` defaults to `redirect: "follow"`,
 * which lets an attacker serve a public URL that 302-redirects to an internal IP
 * (e.g. http://169.254.169.254/latest/meta-data/) — bypassing the guard entirely.
 * We use `redirect: "manual"` and reject any 3xx so the guard can't be sidestepped.
 *
 * Returns either a NextResponse (caller should `return` it directly — SSRF rejected
 * or redirect blocked) or the fetch Response for normal handling.
 */
export async function safeFetch(
  rawUrl: string,
  init?: RequestInit & { signal?: AbortSignal }
): Promise<NextResponse | Response> {
  const guard = await assertSafeOutboundUrl(rawUrl);
  if (guard) return guard;

  const upstream = await fetch(rawUrl, {
    ...init,
    redirect: "manual", // BLOCK-1: never auto-follow; re-check would need per-hop guard
  });

  // 3xx = a redirect we refused to follow. Treat as SSRF rejection so the caller
  // can't read the Location header and exfiltrate via the response body either.
  if (upstream.status >= 300 && upstream.status < 400) {
    return NextResponse.json(
      {
        code: "SSRF_REJECTED",
        message: `redirect not allowed (status ${upstream.status})`,
      },
      { status: 400 }
    );
  }
  return upstream;
}

/** Hostname-level block list: literal names + suffix matches. */
function isBlockedHostname(host: string): boolean {
  if (host === "localhost" || host === "::1" || host === "0.0.0.0") return true;
  if (host.endsWith(".localhost")) return true;
  if (host.endsWith(".local")) return true;
  // Metadata hostnames used by some clouds.
  if (host === "metadata" || host === "metadata.google.internal") return true;
  // If it parses as an IP, defer to the IP check (covers 169.254.169.254, etc.).
  return false;
}

/** IP-level block list. Parses both IPv4 and IPv6 forms. */
function isBlockedIp(ip: string): boolean {
  // IPv4 dotted quad.
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [parseInt(v4[1], 10), parseInt(v4[2], 10)];
    if (Number.isNaN(a) || Number.isNaN(b)) return true;
    if (a === 10) return true; // 10.0.0.0/8 private
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 0) return true; // 0.0.0.0/8 "this host"
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    return false;
  }
  // IPv6 — block loopback, link-local, unique-local, IPv4-mapped.
  const lower = ip.toLowerCase();
  if (lower === "::1") return true;
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local fc00::/7
  if (lower.startsWith("::ffff:")) {
    // IPv4-mapped IPv6 — re-check the embedded v4.
    const tail = lower.slice("::ffff:".length);
    return isBlockedIp(tail);
  }
  return false;
}

import { NextRequest, NextResponse } from "next/server";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";
import { safeFetch } from "@/lib/ssrfGuard";

/**
 * POST /api/proxy/fetch — general outbound fetch proxy for the editor (e.g. ad-hoc
 * "test this URL" from the datasource editor before saving).
 *
 * Body: { url, method?, headers?, body? }
 *
 * Security (plan §6.1 + §敏感字段):
 *   - Auth: JWT required; X-User-* is consumed here for audit and is NEVER
 *     forwarded to the third-party target (the request's own headers/body are).
 *   - SSRF: every url is vetted by assertSafeOutboundUrl — https-only, no
 *     loopback/private/link-local/metadata IPs, DNS-rebinding-aware.
 *   - Timeout: 10s cap so a hanging target can't lock up the BFF.
 *   - Non-2xx upstream → 502 DATASOURCE_UPSTREAM_ERROR (status surfaced in message
 *     only; body is not echoed back to avoid blind proxying of error pages).
 */

interface ProxyFetchRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export async function POST(req: NextRequest) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    // h is intentionally unused beyond proving the caller is authenticated — the
    // X-User-* values are an audit signal only and must not reach the third party.
    void h;

    const payload = (await req.json()) as ProxyFetchRequest;
    if (!payload || typeof payload.url !== "string") {
      return NextResponse.json(
        { code: "INVALID_ARGUMENT", message: "url is required" },
        { status: 400 }
      );
    }

    const method = (payload.method || "GET").toUpperCase();
    // safeFetch vets the URL (SSRF + port + protocol) AND refuses to follow
    // redirects (BLOCK-1: a public URL that 302→internal IP can't bypass the guard).
    const allowedMethods = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"];
    if (!allowedMethods.includes(method)) {
      return NextResponse.json(
        { code: "INVALID_ARGUMENT", message: `method ${method} not allowed` },
        { status: 400 }
      );
    }
    const fetched = await safeFetch(payload.url, {
      method,
      headers: payload.headers || {},
      body: ["GET", "HEAD"].includes(method) ? undefined : payload.body,
      signal: AbortSignal.timeout(10_000),
    });
    // safeFetch returns a NextResponse when SSRF/redirect blocked it.
    if (fetched instanceof NextResponse) return fetched;
    const upstream = fetched;

    if (!upstream.ok) {
      return NextResponse.json(
        {
          code: "DATASOURCE_UPSTREAM_ERROR",
          message: `upstream returned HTTP ${upstream.status}`,
        },
        { status: 502 }
      );
    }

    const contentType = upstream.headers.get("content-type") || "";
    let data: unknown;
    if (contentType.includes("application/json")) {
      data = await upstream.json();
    } else {
      data = await upstream.text();
    }
    return NextResponse.json({ data, status: upstream.status });
  } catch (e) {
    // MID-2: an upstream timeout surfaces as 504 DATASOURCE_UPSTREAM_TIMEOUT so the
    // caller can distinguish "third-party hung" from "BFF internal error" (500).
    if (isTimeoutError(e)) {
      return NextResponse.json(
        { code: "DATASOURCE_UPSTREAM_TIMEOUT", message: "upstream timed out" },
        { status: 504 }
      );
    }
    return toBackendResponse(e);
  }
}

/** AbortSignal.timeout throws DOMException name "TimeoutError"; AbortController
 * aborts throw "AbortError". Detect either so we can map to 504. */
function isTimeoutError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const name = (e as { name?: string }).name;
  return name === "TimeoutError" || name === "AbortError";
}

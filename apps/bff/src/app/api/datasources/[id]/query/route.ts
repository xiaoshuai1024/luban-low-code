import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";
import { safeFetch } from "@/lib/ssrfGuard";

/**
 * POST /api/datasources/:id/query — fetches live data from a stored api datasource
 * at runtime (used by the editor/preview and the SSR site to render a Table bound
 * to a datasource).
 *
 * Flow:
 *   1. Auth: BFF validates JWT; backend requires user.
 *   2. GET /datasources/:id from the backend to load {type, config}.
 *   3. If type != 'api', reject (static datasources have no remote query).
 *   4. SSRF-check config.url through assertSafeOutboundUrl — this is the critical
 *      guard: the URL is user/admin-configured, so the BFF must block SSRF before
 *      issuing the outbound request.
 *   5. Fetch the URL with the configured method/headers. X-User-* headers are NOT
 *      forwarded (plan §敏感字段) — only config-supplied headers reach the third
 *      party. The user identity is recorded only in the BFF audit log (implicit,
 *      via the JWT we validated).
 *   6. Return {data, status} to the caller. Non-2xx upstream → 502 with the
 *      upstream status surfaced in the message (not the body — no leakage).
 */

interface Datasource {
  id: string;
  type: string;
  config?: { url?: string; method?: string; headers?: Record<string, string> };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { id } = await params;

    const ds = await callBackend<Datasource>(
      `/datasources/${encodeURIComponent(id)}`,
      { method: "GET", headers: h }
    );

    if (ds.type !== "api") {
      return NextResponse.json(
        { code: "INVALID_ARGUMENT", message: "only api datasources can be queried" },
        { status: 400 }
      );
    }
    const url = ds.config?.url;
    if (!url) {
      return NextResponse.json(
        { code: "INVALID_ARGUMENT", message: "datasource config.url is missing" },
        { status: 400 }
      );
    }

    // SSRF guard via safeFetch: vets config.url (protocol/host/IP/port) AND refuses
    // to follow redirects (BLOCK-1: public URL that 302→internal IP can't bypass).
    const method = (ds.config?.method || "GET").toUpperCase();
    // Optional request body passthrough for POST datasources.
    let body: BodyInit | undefined;
    if (method !== "GET" && method !== "HEAD") {
      body = await req.text().catch(() => undefined);
    }

    const fetched = await safeFetch(url, {
      method,
      headers: ds.config?.headers || {},
      body,
      // Cap upstream latency so a slow target can't tie up the BFF.
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
    // MID-2: upstream timeout → 504 DATASOURCE_UPSTREAM_TIMEOUT (distinct from 500).
    if (isTimeoutError(e)) {
      return NextResponse.json(
        { code: "DATASOURCE_UPSTREAM_TIMEOUT", message: "upstream timed out" },
        { status: 504 }
      );
    }
    return toBackendResponse(e);
  }
}

function isTimeoutError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const name = (e as { name?: string }).name;
  return name === "TimeoutError" || name === "AbortError";
}

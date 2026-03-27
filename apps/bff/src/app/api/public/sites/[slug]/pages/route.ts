import { NextRequest, NextResponse } from "next/server";
import { BackendHttpError, callBackend } from "@/lib/backendClient";

/**
 * Public API: fetch a published page by site slug + path.
 * Route: GET /api/public/sites/:slug/pages?path=...
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const path = req.nextUrl.searchParams.get("path") ?? "/";

  try {
    const page = await callBackend<unknown>(
      `/public/sites/${encodeURIComponent(slug)}/pages?path=${encodeURIComponent(path)}`,
      { method: "GET" }
    );
    return NextResponse.json(page);
  } catch (err: unknown) {
    if (err instanceof BackendHttpError) {
      return NextResponse.json(
        {
          code: err.code,
          message: err.message,
          details: err.details,
        },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { code: "INTERNAL", message: "Failed to fetch page" },
      { status: 500 }
    );
  }
}

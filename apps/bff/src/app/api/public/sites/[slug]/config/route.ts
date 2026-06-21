import { NextRequest, NextResponse } from "next/server";
import { BackendHttpError, callBackend } from "@/lib/backendClient";

/**
 * V2-T10 Public site config proxy:
 *   GET /api/public/sites/:slug/config → 200 { name, baseUrl, analytics }
 *
 * website 用此获取站点级 analytics 配置（GA4/百度统计/Facebook Pixel），
 * 在 SSR 注入第三方分析 SDK 脚本。公开接口无需鉴权。
 */
interface SiteConfig {
  name: string;
  baseUrl: string;
  analytics: {
    ga4?: { measurementId: string };
    baidu?: { id: string };
    facebook?: { pixelId: string };
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const data = await callBackend<SiteConfig>(
      `/public/sites/${encodeURIComponent(slug)}/config`,
      { method: "GET" }
    );
    return NextResponse.json(data);
  } catch (err: unknown) {
    if (err instanceof BackendHttpError) {
      return NextResponse.json(
        { code: err.code, message: err.message, details: err.details },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { code: "INTERNAL", message: "Failed to fetch site config" },
      { status: 500 }
    );
  }
}

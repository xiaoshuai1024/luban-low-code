import { NextRequest, NextResponse } from "next/server";
import { BackendHttpError, callBackend } from "@/lib/backendClient";

/**
 * V2-T7 Public collection items proxy:
 *   GET /api/public/sites/:slug/collections/:collectionId/items → 200 []
 *
 * website SSR 渲染 CMS 绑定节点时拉取内容项（无需鉴权）。
 */
interface CollectionItem {
  id: string;
  collectionId: string;
  data?: Record<string, unknown>;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; collectionId: string }> }
) {
  const { slug, collectionId } = await params;
  try {
    const data = await callBackend<CollectionItem[]>(
      `/public/sites/${encodeURIComponent(slug)}/collections/${encodeURIComponent(collectionId)}/items`,
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
      { code: "INTERNAL", message: "Failed to fetch collection items" },
      { status: 500 }
    );
  }
}

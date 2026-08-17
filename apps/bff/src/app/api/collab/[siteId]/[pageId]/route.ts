import { NextRequest, NextResponse } from "next/server";
import { callBackend, BackendHttpError } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import {
  toBackendResponse,
  authHeaders,
  unauthenticated,
} from "@/lib/apiHandler";

/**
 * 协作 CRDT 契约层：GET /api/collab/:siteId/:pageId（房间在线用户端点）@J-collab
 *
 * e2e 契约（e2e/flows/collab-contract.spec.ts CC1-CC6）为本端点 SSOT：
 *   - 无/无效 token → 401（apiHandler 既有 JWT 校验链，与 ws authenticateCollab 等价）；
 *   - IDOR：siteId 归属校验（复用后端 GET /sites/{id} 的 SiteOwnershipGuard.assertVisible
 *     判定：owner 或 admin 可见），非属主/不存在统一 403，不泄露站点与房间存在性；
 *   - 无真实 WS 服务（Non-Goal，T22）：onlineUsers 恒空数组、connectionCount 恒 0（CC6 契约）。
 *     未来 WS 服务落地时复用本端点与同一鉴权链（canAccessRoom），在线态由房间连接表提供。
 *
 * realtime_collab FeatureGate 仅做读取与容错（fail-open：未配置/路由暂缺/后端异常一律视为
 * 开启），以 enabled 字段透出，不阻断本端点——契约层只镜像 gate 状态，不发明关断行为。
 */

interface Site {
  id: string;
  ownerUserId?: string | null;
}

interface FeatureGate {
  enabled?: boolean;
}

/** realtime_collab gate fail-open 读取：任何失败（路由缺失/后端错误/响应异常）视为开启，绝不使本端点 500。 */
async function readRealtimeCollabEnabled(
  siteId: string,
  h: { "X-User-ID": string; "X-User-Role": string }
): Promise<boolean> {
  try {
    const gate = await callBackend<FeatureGate>(
      `/public/feature-gates?siteId=${encodeURIComponent(siteId)}&key=realtime_collab`,
      { method: "GET", headers: h }
    );
    return gate?.enabled !== false;
  } catch {
    return true; // fail-open：gate 不可用不等于协作关闭
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string; pageId: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { siteId, pageId } = await params;

    // IDOR 防越权：经后端站点归属判定（404 SITE_NOT_FOUND / 403 PERMISSION_DENIED
    // 均归一为 403，避免向越权者泄露资源存在性）；其余后端错误原样透传。
    try {
      await callBackend<Site>(`/sites/${siteId}`, { method: "GET", headers: h });
    } catch (e) {
      if (e instanceof BackendHttpError && (e.status === 403 || e.status === 404)) {
        return NextResponse.json(
          { code: "FORBIDDEN", message: "无权访问此协作房间" },
          { status: 403 }
        );
      }
      throw e;
    }

    const enabled = await readRealtimeCollabEnabled(siteId, h);

    // 契约层空态：无活跃 WS 连接时列表恒空、计数恒 0（CC6）。
    return NextResponse.json({
      siteId,
      pageId,
      onlineUsers: [] as unknown[],
      connectionCount: 0,
      enabled,
    });
  } catch (e) {
    return toBackendResponse(e);
  }
}

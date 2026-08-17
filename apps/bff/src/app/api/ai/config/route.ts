import { NextRequest } from "next/server";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, unauthenticated } from "@/lib/apiHandler";
import { proxyAiService, roleFromPayload } from "@/lib/aiClient";

/**
 * /api/ai/config — AI 服务模型配置的鉴权反代（e2e ai-assistant.spec B1 契约）。
 *
 * - GET：读当前 provider/model 配置（对应 ai-assistant GET /ai/config）。
 * - PUT：更新 provider 配置（body 原样透传，对应 provider 切换链路）。
 * - 鉴权：luban JWT（无/无效 token → 401，e2e 断言 noAuth.status === 401）。
 * - 角色：JWT payload.role → X-Luban-Role/X-User-Role（admin/user）注入上游。
 * - AI_SERVICE_BASE_URL 未配置 → 503 AI_SERVICE_UNAVAILABLE；配置但不可达 → 502
 *   （e2e 对 authed GET 断言 [200, 502]，两分支都是合法反代行为）。
 */

export async function GET(req: NextRequest) {
  try {
    const payload = parseTokenFromRequest(req);
    if (!payload) return unauthenticated();
    return proxyAiService({
      path: "/ai/config",
      method: "GET",
      role: roleFromPayload(payload),
      userId: payload.sub,
    });
  } catch (e) {
    return toBackendResponse(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const payload = parseTokenFromRequest(req);
    if (!payload) return unauthenticated();
    const body = await req.text();
    return proxyAiService({
      path: "/ai/config",
      method: "PUT",
      role: roleFromPayload(payload),
      userId: payload.sub,
      body: body || undefined,
    });
  } catch (e) {
    return toBackendResponse(e);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse } from "@/lib/apiHandler";
import {
  forceVisitorNoTools,
  proxyAiService,
  roleFromPayload,
} from "@/lib/aiClient";

/**
 * POST /api/ai/chat — AI 对话反代（SSE 流式，对应 ai-assistant POST /ai/chat）。
 *
 * 公开端点（C 端访客问答，design D4 的 visitor 公开判定）：
 * - 无 token → visitor 角色：注入 X-Luban-Role/X-User-Role: visitor，且转发体
 *   强制 tools=[]（禁工具调用，调用方传任何 tools 都被覆盖）；
 * - 有效 token → user/admin 角色，body 原样转发；
 * - 响应为 SSE 流，body 原样透传（不缓冲、不解析）。
 *
 * 注：e2e ai-assistant.spec 的 C 端用例直连 AI 服务（:8100）验证 visitor 契约，
 * 本端点是 BFF 侧同一契约的反代入口（bff_user.py 文档的 M3 信任架构）。
 */

/** 匿名访客固定身份：visitor 无特权（工具禁用），仅用于 AI 侧会话/审计归属。 */
const VISITOR_USER_ID = "visitor";

export async function POST(req: NextRequest) {
  try {
    const payload = parseTokenFromRequest(req);
    const role = roleFromPayload(payload);

    let parsed: Record<string, unknown>;
    try {
      parsed = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { code: "INVALID_ARGUMENT", message: "request body must be JSON" },
        { status: 400 }
      );
    }

    const outbound = forceVisitorNoTools(parsed, role);
    return proxyAiService({
      path: "/ai/chat",
      method: "POST",
      role,
      userId: payload?.sub ?? VISITOR_USER_ID,
      body: JSON.stringify(outbound),
      stream: true,
    });
  } catch (e) {
    return toBackendResponse(e);
  }
}

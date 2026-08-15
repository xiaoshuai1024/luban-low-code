import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { toBackendResponse } from "@/lib/apiHandler";

/**
 * POST /api/forms/:id/submit — 公开留资提交（免 token）。
 * 访客身份（IP/visitor）由本层注入 X-Forwarded-For / X-Visitor-ID 透传后端。
 * 后端负责防刷 + 去重 + 加密入库；错误（LEAD_DUPLICATE/LEAD_SPAM_BLOCKED）透传给前端。
 *
 * 安全约束：不向后端返回 leadId（避免向访客暴露内部 UUID），
 * 仅返回提交状态与去重标记。
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    // 注入 path formId 到 body（后端 LeadSubmitRequest.formId @NotBlank，前端/e2e 只传 contact）
    body.formId = id;
    const headers = {
      "X-Forwarded-For": req.headers.get("x-forwarded-for") || "",
      "X-Visitor-ID": req.headers.get("x-visitor-id") || "",
    };
    const data = await callBackend<{ leadId?: string; status: string; dedup: boolean }>(`/lead/forms/${id}/submit`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    // 安全：剥离 leadId，不向访客暴露内部 UUID
    const { leadId: _, ...publicResult } = data;
    return NextResponse.json(publicResult);
  } catch (e) {
    if (e instanceof SyntaxError) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid JSON body" },
        { status: 400 }
      );
    }
    return toBackendResponse(e);
  }
}

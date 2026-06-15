import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { toBackendResponse } from "@/lib/apiHandler";

/**
 * POST /api/forms/:id/submit — 公开留资提交（免 token）。
 * 访客身份（IP/visitor）由本层注入 X-Forwarded-For / X-Visitor-ID 透传后端。
 * 后端负责防刷 + 去重 + 加密入库；错误（LEAD_DUPLICATE/LEAD_SPAM_BLOCKED）透传给前端。
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const headers = {
      "X-Forwarded-For": req.headers.get("x-forwarded-for") || "",
      "X-Visitor-ID": req.headers.get("x-visitor-id") || "",
    };
    const data = await callBackend(`/lead/forms/${id}/submit`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (e) {
    return toBackendResponse(e);
  }
}

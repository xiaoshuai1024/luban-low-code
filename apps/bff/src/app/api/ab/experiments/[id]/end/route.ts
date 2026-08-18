import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

interface AbVariant {
  id: string;
  variantKey: string;
  weight: number;
  schema?: unknown;
}

interface AbExperiment {
  id: string;
  siteId: string;
  pageId?: string | null;
  name: string;
  status: string;
  startedAt?: string;
  endedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  variants: AbVariant[];
}

/** 结束实验（POST /api/ab/experiments/:id/end → 后端 status=ended + ended_at；幂等）。 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { id } = await params;
    const data = await callBackend<AbExperiment>(
      `/ab/experiments/${encodeURIComponent(id)}/end`,
      { method: "POST", headers: h }
    );
    return NextResponse.json(data);
  } catch (e) {
    return toBackendResponse(e);
  }
}

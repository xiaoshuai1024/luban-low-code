import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

interface Site {
  id: string;
  name: string;
  slug?: string;
  baseUrl?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { siteId } = await params;
    const site = await callBackend<Site>(`/sites/${siteId}`, {
      method: "GET",
      headers: h,
    });
    return NextResponse.json(site);
  } catch (e) {
    return toBackendResponse(e);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { siteId } = await params;
    const body = await req.json();
    const site = await callBackend<Site>(`/sites/${siteId}`, {
      method: "PUT",
      headers: h,
      body: JSON.stringify(body),
    });
    return NextResponse.json(site);
  } catch (e) {
    return toBackendResponse(e);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();
    const { siteId } = await params;
    await callBackend<unknown>(`/sites/${siteId}`, {
      method: "DELETE",
      headers: h,
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return toBackendResponse(e);
  }
}


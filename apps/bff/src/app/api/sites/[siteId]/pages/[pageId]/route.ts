import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";

interface PageMeta {
  id: string;
  siteId: string;
  name: string;
  path: string;
  status?: string;
  schema?: unknown;
  createdAt?: string;
  updatedAt?: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string; pageId: string }> }
) {
  const { siteId, pageId } = await params;
  const headers: HeadersInit = {
    "X-User-ID": req.headers.get("x-user-id") || "",
    "X-User-Role": req.headers.get("x-user-role") || "",
  };
  const page = await callBackend<PageMeta>(
    `/sites/${siteId}/pages/${pageId}`,
    {
      method: "GET",
      headers,
    }
  );
  return NextResponse.json(page);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string; pageId: string }> }
) {
  const { siteId, pageId } = await params;
  const headers: HeadersInit = {
    "X-User-ID": req.headers.get("x-user-id") || "",
    "X-User-Role": req.headers.get("x-user-role") || "",
  };
  const body = await req.json();
  const page = await callBackend<PageMeta>(
    `/sites/${siteId}/pages/${pageId}`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    }
  );
  return NextResponse.json(page);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string; pageId: string }> }
) {
  const { siteId, pageId } = await params;
  const headers: HeadersInit = {
    "X-User-ID": req.headers.get("x-user-id") || "",
    "X-User-Role": req.headers.get("x-user-role") || "",
  };
  await callBackend<unknown>(
    `/sites/${siteId}/pages/${pageId}`,
    {
      method: "DELETE",
      headers,
    }
  );
  return NextResponse.json(null, { status: 204 });
}


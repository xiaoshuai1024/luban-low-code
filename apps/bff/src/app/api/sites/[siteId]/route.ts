import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";

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
  { params }: { params: { siteId: string } }
) {
  const headers: HeadersInit = {
    "X-User-ID": req.headers.get("x-user-id") || "",
    "X-User-Role": req.headers.get("x-user-role") || "",
  };
  const site = await callBackend<Site>(`/sites/${params.siteId}`, {
    method: "GET",
    headers,
  });
  return NextResponse.json(site);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { siteId: string } }
) {
  const headers: HeadersInit = {
    "X-User-ID": req.headers.get("x-user-id") || "",
    "X-User-Role": req.headers.get("x-user-role") || "",
  };
  const body = await req.json();
  const site = await callBackend<Site>(`/sites/${params.siteId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  return NextResponse.json(site);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { siteId: string } }
) {
  const headers: HeadersInit = {
    "X-User-ID": req.headers.get("x-user-id") || "",
    "X-User-Role": req.headers.get("x-user-role") || "",
  };
  await callBackend<unknown>(`/sites/${params.siteId}`, {
    method: "DELETE",
    headers,
  });
  return NextResponse.json(null, { status: 204 });
}


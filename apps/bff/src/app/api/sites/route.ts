import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";

interface Site {
  id: string;
  name: string;
  slug?: string;
  baseUrl?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function GET(req: NextRequest) {
  const payload = parseTokenFromRequest(req);
  if (!payload) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", message: "invalid token" },
      { status: 401 }
    );
  }
  const headers: HeadersInit = {
    "X-User-ID": payload.sub,
    "X-User-Role": payload.role,
  };
  const sites = await callBackend<Site[]>("/sites", {
    method: "GET",
    headers,
  });
  return NextResponse.json(sites);
}

export async function POST(req: NextRequest) {
  const payload = parseTokenFromRequest(req);
  if (!payload) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", message: "invalid token" },
      { status: 401 }
    );
  }
  const headers: HeadersInit = {
    "X-User-ID": payload.sub,
    "X-User-Role": payload.role,
  };
  const body = await req.json();
  const site = await callBackend<Site>("/sites", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return NextResponse.json(site, { status: 201 });
}



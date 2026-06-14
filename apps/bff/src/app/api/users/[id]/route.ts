import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";

interface User {
  id: string;
  username: string;
  name?: string;
  role?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = parseTokenFromRequest(req);
  if (!payload) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", message: "invalid token" },
      { status: 401 }
    );
  }
  const { id } = await params;
  const headers: HeadersInit = {
    "X-User-ID": payload.sub,
    "X-User-Role": payload.role,
  };
  const user = await callBackend<User>(`/users/${id}`, {
    method: "GET",
    headers,
  });
  return NextResponse.json(user);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = parseTokenFromRequest(req);
  if (!payload) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", message: "invalid token" },
      { status: 401 }
    );
  }
  const { id } = await params;
  const headers: HeadersInit = {
    "X-User-ID": payload.sub,
    "X-User-Role": payload.role,
  };
  const body = await req.json();
  const user = await callBackend<User>(`/users/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  return NextResponse.json(user);
}

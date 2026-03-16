import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backendClient";

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
  { params }: { params: { id: string } }
) {
  const headers: HeadersInit = {
    "X-User-ID": req.headers.get("x-user-id") || "",
    "X-User-Role": req.headers.get("x-user-role") || "",
  };
  const user = await callBackend<User>(`/users/${params.id}`, {
    method: "GET",
    headers,
  });
  return NextResponse.json(user);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const headers: HeadersInit = {
    "X-User-ID": req.headers.get("x-user-id") || "",
    "X-User-Role": req.headers.get("x-user-role") || "",
  };
  const body = await req.json();
  const user = await callBackend<User>(`/users/${params.id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  return NextResponse.json(user);
}


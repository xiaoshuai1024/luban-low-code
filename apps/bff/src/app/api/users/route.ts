import { NextRequest, NextResponse } from "next/server";
import { callBackend, BackendHttpError } from "@/lib/backendClient";
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

export async function GET(req: NextRequest) {
  const payload = parseTokenFromRequest(req);
  if (!payload) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", message: "invalid token" },
      { status: 401 }
    );
  }
  // #region agent log
  fetch("http://127.0.0.1:7896/ingest/7e684da9-fd62-4bcf-a26b-76516de9ccd8", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "6eb26e",
    },
    body: JSON.stringify({
      sessionId: "6eb26e",
      runId: "users-403",
      hypothesisId: "H1",
      location: "src/app/api/users/route.ts:GET",
      message: "BFF users GET payload and headers",
      data: {
        sub: payload.sub,
        role: payload.role,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion agent log

  const headers: HeadersInit = {
    "X-User-ID": payload.sub,
    "X-User-Role": payload.role,
  };
  const searchParams = req.nextUrl.searchParams;
  const page = searchParams.get("page");
  const size = searchParams.get("size");
  const keyword = searchParams.get("keyword");

  const qs = new URLSearchParams();
  if (page) qs.set("page", page);
  if (size) qs.set("size", size);
  if (keyword) qs.set("keyword", keyword);

  const path = qs.toString() ? `/users?${qs.toString()}` : "/users";

  try {
    const res = await callBackend<{ list: User[]; total: number }>(path, {
      method: "GET",
      headers,
    });
    return NextResponse.json(res);
  } catch (err) {
    // #region agent log
    fetch("http://127.0.0.1:7896/ingest/7e684da9-fd62-4bcf-a26b-76516de9ccd8", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "6eb26e",
      },
      body: JSON.stringify({
        sessionId: "6eb26e",
        runId: "users-403",
        hypothesisId: "H2",
        location: "src/app/api/users/route.ts:GET",
        message: "BFF users GET backend error",
        data: {
          isBackendHttpError: err instanceof BackendHttpError,
          status: err instanceof BackendHttpError ? err.status : null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log

    if (err instanceof BackendHttpError && err.status === 403) {
      return NextResponse.json(
        { code: "PERMISSION_DENIED", message: "无权限访问用户管理，请使用管理员账号登录" },
        { status: 403 }
      );
    }
    throw err;
  }
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
  try {
    const user = await callBackend<User>("/users", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    if (err instanceof BackendHttpError && err.status === 403) {
      return NextResponse.json(
        { code: "PERMISSION_DENIED", message: "无权限访问用户管理，请使用管理员账号登录" },
        { status: 403 }
      );
    }
    throw err;
  }
}


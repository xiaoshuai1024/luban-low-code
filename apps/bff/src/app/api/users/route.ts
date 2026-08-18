import { NextRequest, NextResponse } from "next/server";
import { callBackend, BackendHttpError } from "@/lib/backendClient";
import { parseTokenFromRequest } from "@/lib/authToken";
import { toBackendResponse, authHeaders, unauthenticated } from "@/lib/apiHandler";

interface User {
  id: string;
  username: string;
  name?: string;
  role?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** 403 时替换为面向管理后台的友好文案；其余错误原样透传 */
function usersErrorResponse(e: unknown): NextResponse {
  if (e instanceof BackendHttpError && e.status === 403) {
    return NextResponse.json(
      { code: "PERMISSION_DENIED", message: "无权限访问用户管理，请使用管理员账号登录" },
      { status: 403 }
    );
  }
  return toBackendResponse(e);
}

/** GET /api/users?page=&size=&keyword= → 分页用户列表 */
export async function GET(req: NextRequest) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();

    const searchParams = req.nextUrl.searchParams;
    const page = searchParams.get("page");
    const size = searchParams.get("size");
    const keyword = searchParams.get("keyword");

    const qs = new URLSearchParams();
    if (page) qs.set("page", page);
    if (size) qs.set("size", size);
    if (keyword) qs.set("keyword", keyword);

    const path = qs.toString() ? `/users?${qs.toString()}` : "/users";
    const res = await callBackend<{ list: User[]; total: number }>(path, {
      method: "GET",
      headers: h,
    });
    return NextResponse.json(res);
  } catch (err) {
    return usersErrorResponse(err);
  }
}

/** POST /api/users → 新建用户（201；409/403 透传） */
export async function POST(req: NextRequest) {
  try {
    const h = authHeaders(parseTokenFromRequest(req));
    if (!h) return unauthenticated();

    // 前置解析：仅客户端坏 JSON 归 400；外层 catch 只兜后端错误
    const body = await req.json().catch(() => null);
    if (body === null) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid JSON body" },
        { status: 400 }
      );
    }
    const user = await callBackend<User>("/users", {
      method: "POST",
      headers: h,
      body: JSON.stringify(body),
    });
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    return usersErrorResponse(err);
  }
}

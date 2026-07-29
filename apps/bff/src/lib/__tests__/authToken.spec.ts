import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { parseTokenFromRequest, signToken } from "@/lib/authToken";

const SECRET =
  process.env.AUTH_JWT_SECRET || "dev-secret-change-me-in-prod";

function makeRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/test", { headers });
}

describe("parseTokenFromRequest", () => {
  beforeEach(() => {
    // 确保测试用 secret 稳定，不受环境变量干扰
    process.env.AUTH_JWT_SECRET = SECRET;
  });

  it("有效 JWT → 返回 payload（含 sub/role/token）", () => {
    const token = signToken({ id: "u-1", username: "alice", role: "admin" });
    const req = makeRequest({ authorization: `Bearer ${token}` });

    const payload = parseTokenFromRequest(req);

    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe("u-1");
    expect(payload!.username).toBe("alice");
    expect(payload!.role).toBe("admin");
    expect(payload!.token).toBe(token);
  });

  it("签名错误的 token → 返回 null", () => {
    // 用错误 secret 签发，模拟伪造/篡改
    const forged = jwt.sign(
      { sub: "u-2", username: "bob", role: "user" },
      "wrong-secret"
    );
    const req = makeRequest({ authorization: `Bearer ${forged}` });

    expect(parseTokenFromRequest(req)).toBeNull();
  });

  it("缺少 authorization header → 返回 null", () => {
    const req = makeRequest({});
    expect(parseTokenFromRequest(req)).toBeNull();
  });

  it("authorization 仅 'Bearer '（无 token）→ 返回 null", () => {
    const req = makeRequest({ authorization: "Bearer " });
    expect(parseTokenFromRequest(req)).toBeNull();
  });

  it("authorization 非 Bearer 前缀 → 返回 null", () => {
    const req = makeRequest({ authorization: "Basic abc123" });
    expect(parseTokenFromRequest(req)).toBeNull();
  });
});

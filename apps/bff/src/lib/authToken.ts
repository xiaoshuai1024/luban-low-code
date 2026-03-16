import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

const AUTH_JWT_SECRET =
  process.env.AUTH_JWT_SECRET || "dev-secret-change-me-in-prod";

interface JwtPayload {
  sub: string; // userId
  username: string;
  role: string;
}

export function signToken(user: {
  id: string;
  username: string;
  role?: string;
}): string {
  const payload: JwtPayload = {
    sub: user.id,
    username: user.username,
    role: user.role || "user",
  };
  return jwt.sign(payload, AUTH_JWT_SECRET, { expiresIn: "7d" });
}

export function parseTokenFromRequest(
  req: NextRequest
): (JwtPayload & { token: string }) | null {
  const auth = req.headers.get("authorization") || "";
  const [, token] = auth.split(" ");
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, AUTH_JWT_SECRET) as JwtPayload;
    return { ...decoded, token };
  } catch {
    return null;
  }
}


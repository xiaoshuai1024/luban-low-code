import { callBff, refreshToken, getAccessToken } from "./bff-client";

export interface AuthStatus {
  authenticated: boolean;
  userId?: string;
  username?: string;
  role?: string;
  expiresAt?: number;
}

export async function validateApiKey(): Promise<AuthStatus> {
  const apiKey = process.env.LUBAN_API_KEY;
  if (!apiKey) {
    return { authenticated: false };
  }

  const success = await refreshToken();
  if (!success) {
    return { authenticated: false };
  }

  const token = getAccessToken();
  if (!token) {
    return { authenticated: false };
  }

  // Decode JWT to get user info (without verification, just reading payload)
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return { authenticated: false };
    }
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );
    return {
      authenticated: true,
      userId: payload.sub || payload.userId,
      username: payload.username,
      role: payload.role,
      expiresAt: payload.exp ? payload.exp * 1000 : undefined,
    };
  } catch {
    return { authenticated: false };
  }
}

export async function startupAuth(): Promise<void> {
  const apiKey = process.env.LUBAN_API_KEY;
  if (!apiKey) {
    console.error("LUBAN_API_KEY environment variable is not set");
    process.exit(1);
  }

  const status = await validateApiKey();
  if (!status.authenticated) {
    console.error(
      "Failed to authenticate with BFF. Check LUBAN_API_KEY is valid."
    );
    process.exit(1);
  }

  console.log("JWT token refreshed successfully");
}

export function getAuthStatus(): AuthStatus {
  const token = getAccessToken();
  if (!token) {
    return { authenticated: false };
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return { authenticated: false };
    }
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );
    return {
      authenticated: true,
      userId: payload.sub || payload.userId,
      username: payload.username,
      role: payload.role,
      expiresAt: payload.exp ? payload.exp * 1000 : undefined,
    };
  } catch {
    return { authenticated: false };
  }
}

import axios from 'axios';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const BFF_BASE_URL = process.env.BFF_BASE_URL || 'http://localhost:3100';
const TOKEN_PATH = process.env.LUBAN_TOKEN_PATH || null;

interface TokenData {
  accessToken: string;
  expiresAt?: number; // unix epoch ms
}

let tokenData: TokenData | null = null;
let apiKey: string | null = null;

/** Decode JWT payload without verifying signature. Returns null on malformed token. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const raw = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(raw, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Returns the cached JWT token, or null if not authenticated or expired.
 * Uses a 30-second buffer before actual expiry to avoid race conditions.
 */
export function getToken(): string | null {
  if (!tokenData) return null;
  if (tokenData.expiresAt && Date.now() >= tokenData.expiresAt - 30_000) {
    return null;
  }
  return tokenData.accessToken;
}

/** Alias for backward compatibility. */
export const getAuthToken: typeof getToken = getToken;

/**
 * Re-authenticate using the cached API key and update the in-memory token.
 * Also persists to LUBAN_TOKEN_PATH if configured.
 * Throws on failure.
 */
export async function refreshToken(): Promise<void> {
  if (!apiKey) {
    throw new Error('Cannot refresh token: LUBAN_API_KEY not available');
  }

  let response;
  try {
    response = await axios.post<{ token?: string; accessToken?: string }>(
      `${BFF_BASE_URL}/api/auth/api-key/login`,
      { apiKey },
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as { message?: string } | undefined;
      throw new Error(`Token refresh failed: ${data?.message || error.message}`);
    }
    throw new Error('Token refresh failed: Unknown error');
  }

  const jwt = response.data.token || response.data.accessToken || null;
  if (!jwt) {
    throw new Error('Token refresh returned no token');
  }

  const decoded = decodeJwtPayload(jwt);
  tokenData = {
    accessToken: jwt,
    expiresAt: decoded?.exp ? Number(decoded.exp) * 1000 : undefined,
  };

  // Optionally persist to disk
  if (TOKEN_PATH) {
    try {
      await writeFile(TOKEN_PATH, JSON.stringify(tokenData, null, 2), 'utf-8');
    } catch {
      // Non-fatal: cache file write failure should not crash the process
    }
  }

  console.error('JWT token refreshed successfully');
}

/**
 * Initialize authentication:
 * 1. Reads LUBAN_API_KEY from environment
 * 2. Attempts to load cached token from LUBAN_TOKEN_PATH
 * 3. Falls back to API key login if no valid cached token
 *
 * Must be called once at startup. Throws on failure — caller should exit.
 */
export async function initialize(): Promise<void> {
  apiKey = process.env.LUBAN_API_KEY || null;

  if (!apiKey) {
    throw new Error(
      'LUBAN_API_KEY environment variable is not set. Authentication cannot proceed.',
    );
  }

  // Try loading cached token from file
  if (TOKEN_PATH && existsSync(TOKEN_PATH)) {
    try {
      const raw = await readFile(TOKEN_PATH, 'utf-8');
      const cached: TokenData = JSON.parse(raw);
      if (cached.accessToken) {
        const decoded = decodeJwtPayload(cached.accessToken);
        const exp = cached.expiresAt || (decoded?.exp ? Number(decoded.exp) * 1000 : undefined);
        tokenData = { accessToken: cached.accessToken, expiresAt: exp };
        if (exp && Date.now() < exp) {
          console.error(`Loaded cached JWT from ${TOKEN_PATH}`);
          return;
        }
        // Token expired in cache, fall through to refresh
        console.error('Cached JWT expired, re-authenticating...');
        tokenData = null;
      }
    } catch {
      // Corrupt cache file — ignore and re-authenticate
      tokenData = null;
    }
  }

  await refreshToken();
}

/**
 * Get authenticated user info from the cached JWT.
 * Returns null if not authenticated, or an object with userId, username, role.
 */
export function getAuthUser(): { userId: string | null; username: string | null; role: string | null } | null {
  if (!tokenData?.accessToken) return null;
  const decoded = decodeJwtPayload(tokenData.accessToken);
  if (!decoded) return null;
  return {
    userId: (decoded.sub as string) || (decoded.userId as string) || null,
    username: (decoded.username as string) || null,
    role: (decoded.role as string) || null,
  };
}

/**
 * Get the JWT token expiry time as an ISO string.
 * Returns null if not authenticated or no expiry available.
 */
export function getTokenExpiresAt(): string | null {
  if (!tokenData?.expiresAt) return null;
  return new Date(tokenData.expiresAt).toISOString();
}

/** @deprecated Use `initialize()` instead. */
export const authenticate: typeof initialize = initialize;

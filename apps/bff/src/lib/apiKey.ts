/** Response from POST /backend/auth/api-key/validate */
export interface ApiKeyValidateResponse {
  userId: string;
  username: string;
  role: string;
}

/** API key in list responses (no raw key exposed). */
export interface ApiKeyResponse {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  status: string;
  lastUsedAt: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

/** Create response (includes the full raw apiKey once — caller must store immediately). */
export interface ApiKeyCreateResponse {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  apiKey: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

/** Payload for creating a new API key. */
export interface ApiKeyCreateRequest {
  name: string;
  /** ISO‑8601 timestamp; optional — omit for no expiry. */
  expiresAt?: string;
}

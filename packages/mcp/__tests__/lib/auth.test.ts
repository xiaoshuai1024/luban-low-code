import { describe, it, expect, beforeEach, vi } from "vitest";
import { getToken, getAuthUser, getTokenExpiresAt } from "../../src/auth.js";

// Mock axios to prevent real HTTP calls
vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => ({
      request: vi.fn(),
      post: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.LUBAN_API_KEY;
});

describe("getToken", () => {
  it("should return null when no token is cached", () => {
    expect(getToken()).toBeNull();
  });
});

describe("getAuthUser", () => {
  it("should return null when no token is cached", () => {
    expect(getAuthUser()).toBeNull();
  });
});

describe("getTokenExpiresAt", () => {
  it("should return null when no token is cached", () => {
    expect(getTokenExpiresAt()).toBeNull();
  });
});

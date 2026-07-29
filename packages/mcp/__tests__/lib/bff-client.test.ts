import { describe, it, expect, beforeEach, vi } from "vitest";
import { callBff, BffError } from "../../src/lib/bff-client.js";

// Mock auth module
vi.mock("../../src/auth.js", () => ({
  getToken: vi.fn(),
  refreshToken: vi.fn(),
}));

// Mock axios
const mockRequest = vi.fn();
vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => ({
      request: mockRequest,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("callBff", () => {
  it("should make a GET request and return response data", async () => {
    mockRequest.mockResolvedValue({ data: { sites: [{ id: "s1" }] } });

    const result = await callBff("GET", "/api/sites");

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "GET", url: "/api/sites" }),
    );
    expect(result).toEqual({ sites: [{ id: "s1" }] });
  });

  it("should make a POST request with body", async () => {
    mockRequest.mockResolvedValue({ data: { id: "new-site" } });

    const result = await callBff("POST", "/api/sites", { name: "Test" });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "/api/sites",
        data: { name: "Test" },
      }),
    );
    expect(result).toEqual({ id: "new-site" });
  });

  it("should convert BFF error responses to BffError", async () => {
    const axiosError = new Error("Not Found");
    Object.assign(axiosError, {
      isAxiosError: true,
      response: {
        status: 404,
        data: { code: 40401, message: "Site not found" },
      },
    });
    mockRequest.mockRejectedValue(axiosError);

    await expect(callBff("GET", "/api/sites/nonexistent")).rejects.toThrow(BffError);
  });
});

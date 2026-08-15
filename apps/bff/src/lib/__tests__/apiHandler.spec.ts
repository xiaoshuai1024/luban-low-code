import { describe, it, expect } from "vitest";
import {
  toBackendResponse,
  authHeaders,
  unauthenticated,
  stripUntrustedHeaders,
  UNTRUSTED_INTERNAL_HEADERS,
} from "@/lib/apiHandler";
import { BackendHttpError } from "@/lib/backendClient";

describe("toBackendResponse", () => {
  it("BackendHttpError → 透传 status/code/message/details", async () => {
    const res = toBackendResponse(
      new BackendHttpError(409, "FORM_HAS_LEADS", "表单已有留资数据", { formId: "f-1" })
    );
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      code: "FORM_HAS_LEADS",
      message: "表单已有留资数据",
      details: { formId: "f-1" },
    });
  });

  it("普通异常 → 500 INTERNAL", async () => {
    const res = toBackendResponse(new Error("boom"));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ code: "INTERNAL", message: "boom" });
  });
});

describe("authHeaders", () => {
  it("未鉴权（null）→ null", () => {
    expect(authHeaders(null)).toBeNull();
  });

  it("已鉴权 → 注入 X-User-ID / X-User-Role（role 缺省 user）", () => {
    expect(authHeaders({ sub: "u-1", role: "admin" })).toEqual({
      "X-User-ID": "u-1",
      "X-User-Role": "admin",
    });
    expect(authHeaders({ sub: "u-2", role: "" })).toEqual({
      "X-User-ID": "u-2",
      "X-User-Role": "user",
    });
  });
});

describe("unauthenticated", () => {
  it("返回 401 UNAUTHENTICATED", async () => {
    const res = unauthenticated();
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});

describe("stripUntrustedHeaders", () => {
  it("剥离客户端可伪造的内部信任头（大小写不敏感）", () => {
    const headers = new Headers({
      authorization: "Bearer t",
      "content-type": "application/json",
      "X-User-ID": "forged-admin-id",
      "x-user-role": "admin",
      "X-Internal-Auth": "forged-secret",
    });
    const cleaned = stripUntrustedHeaders(headers);
    expect(cleaned.get("x-user-id")).toBeNull();
    expect(cleaned.get("x-user-role")).toBeNull();
    expect(cleaned.get("x-internal-auth")).toBeNull();
    // 非敏感头保留
    expect(cleaned.get("authorization")).toBe("Bearer t");
    expect(cleaned.get("content-type")).toBe("application/json");
  });

  it("不修改入参 Headers（返回新实例）", () => {
    const headers = new Headers({ "X-User-ID": "forged" });
    const cleaned = stripUntrustedHeaders(headers);
    expect(cleaned).not.toBe(headers);
    expect(headers.get("x-user-id")).toBe("forged");
  });

  it("UNTRUSTED_INTERNAL_HEADERS 覆盖三个内部头", () => {
    expect([...UNTRUSTED_INTERNAL_HEADERS]).toEqual([
      "x-user-id",
      "x-user-role",
      "x-internal-auth",
    ]);
  });
});

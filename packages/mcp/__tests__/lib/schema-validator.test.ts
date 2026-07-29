import { describe, it, expect } from "vitest";
import { validatePageSchema } from "../../src/lib/schema-validator.js";

describe("validatePageSchema", () => {
  it("should return valid=true for a legal LubanContainer schema", () => {
    const schema = {
      nodes: [
        {
          id: "page-root",
          type: "LubanContainer",
          children: [
            {
              id: "header-1",
              type: "LubanHeader",
              props: { title: "Hello" },
            },
          ],
          style: { backgroundColor: "#fff" },
        },
      ],
    };

    const result = validatePageSchema(schema);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should return valid=true for minimal valid schema", () => {
    const schema = { nodes: [{ id: "root", type: "LubanContainer" }] };
    const result = validatePageSchema(schema);
    expect(result.valid).toBe(true);
  });

  it("should return error when root type is not LubanContainer", () => {
    const schema = { nodes: [{ id: "page-root", type: "LubanPage" }] };
    const result = validatePageSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain(
      '根节点 type 必须是 "LubanContainer"',
    );
  });

  it("should return error for null schema", () => {
    const result = validatePageSchema(null);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain("必须是 JSON 对象");
  });

  it("should return error when missing nodes array", () => {
    const result = validatePageSchema({});
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain("缺少 nodes 数组");
  });

  it("should return error when children is not an array", () => {
    const result = validatePageSchema({
      nodes: [
        {
          id: "root",
          type: "LubanContainer",
          children: "not-an-array",
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain("children 必须是数组");
  });

  it("should accumulate multiple validation errors", () => {
    const result = validatePageSchema({
      nodes: [
        {
          type: "LubanPage",
          children: "invalid",
          style: 123,
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
    expect(result.errors.some((e) => e.message.includes("根节点 type 必须是"))).toBe(true);
  });
});

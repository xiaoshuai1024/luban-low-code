import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerLeadTools } from "../../src/tools/lead.js";

// Hoisted by Vitest to apply before all imports
vi.mock("../../src/lib/bff-client.js", () => ({
  callBff: vi.fn(),
}));

describe("registerLeadTools", () => {
  let server: McpServer;
  let client: Client;

  beforeEach(async () => {
    vi.clearAllMocks();

    server = new McpServer({
      name: "@luban/mcp-server/test",
      version: "0.1.0",
    });

    registerLeadTools(server);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test-client", version: "1.0.0" });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  it("should register all lead tools", async () => {
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name);
    expect(toolNames).toContain("lead_list");
    expect(toolNames).toContain("lead_get");
    expect(toolNames).toContain("lead_updateStatus");
    expect(toolNames).toContain("lead_export");
  });

  it("should include descriptions for each tool", async () => {
    const result = await client.listTools();
    const ourTools = result.tools.filter(t => t.name.startsWith("lead_"));
    for (const tool of ourTools) {
      expect(tool.description).toBeTruthy();
    }
  });

  it("should have proper inputSchema for tools with parameters", async () => {
    const result = await client.listTools();
    const ourTools = result.tools.filter(t => t.name.startsWith("lead_"));
    for (const tool of ourTools) {
      expect(tool.inputSchema).toBeDefined();
    }
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

describe("MCP Server smoke test", () => {
  let server: McpServer;
  let client: Client;

  beforeEach(async () => {
    vi.clearAllMocks();

    server = new McpServer({
      name: "@luban/mcp-server/test",
      version: "0.1.0",
    });

    // Register a minimal set of tools for smoke testing
    server.registerTool(
      "health",
      { description: "Health check endpoint" },
      async () => ({
        content: [{ type: "text" as const, text: "ok" }],
      }),
    );

    server.registerTool(
      "ping",
      { description: "Response latency test" },
      async () => ({
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ pong: true }),
          },
        ],
      }),
    );

    // Register a resource
    server.resource(
      "Health Status",
      "luban://health",
      async (uri: URL) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain",
            text: "healthy",
          },
        ],
      }),
    );

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
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

  // --- Tools Registration ---
  it("should list all registered tools", async () => {
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name).sort();
    expect(toolNames).toEqual(["health", "ping"]);
  });

  it("should include description for each tool", async () => {
    const result = await client.listTools();
    for (const tool of result.tools) {
      expect(tool.description).toBeTruthy();
    }
  });

  // --- Tool Invocation ---
  it("should respond to health check", async () => {
    const result = await client.callTool({ name: "health" });
    expect(result.isError).toBeFalsy();
    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toBe("ok");
  });

  it("should respond to ping", async () => {
    const result = await client.callTool({ name: "ping", arguments: {} });
    expect(result.isError).toBeFalsy();
    const payload = JSON.parse(result.content[0].text);
    expect(payload.pong).toBe(true);
  });

  // --- Resource ---
  it("should list all registered resources", async () => {
    const result = await client.listResources();
    const uris = result.resources.map((r) => r.uri).sort();
    expect(uris).toEqual(["luban://health"]);
  });

  it("should read a static resource", async () => {
    const result = await client.readResource({ uri: "luban://health" });
    expect(result.contents).toHaveLength(1);
    expect(result.contents[0].text).toContain("healthy");
  });

  // --- Error handling ---
  it("should return isError=true for non-existent tool", async () => {
    const result = await client.callTool({ name: "no_such_tool" });
    expect(result.isError).toBe(true);
  });
});

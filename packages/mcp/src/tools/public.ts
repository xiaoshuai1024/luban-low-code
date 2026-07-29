import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v3';

/**
 * Register public tools that do not require authentication.
 */
export function registerPublicTools(server: McpServer): void {
  server.registerTool(
    'health',
    {
      description: '健康检查端点（无需认证）',
    },
    async () => {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                status: 'ok',
                server: '@luban-low-code/mcp-server',
                version: '0.0.1',
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    'ping',
    {
      description: '响应延迟测试（无需认证）',
      inputSchema: {
        message: z.string().describe('回显消息').optional(),
      },
    },
    async ({ message }) => {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ pong: true, echo: message ?? 'ping' }, null, 2),
          },
        ],
      };
    },
  );
}

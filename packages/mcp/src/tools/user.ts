import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v3';
import { callBff } from '../lib/bff-client.js';

export function registerUserTools(server: McpServer): void {
  server.registerTool(
    'user_list',
    {
      description: 'user list',
      inputSchema: {
        page: z.number().optional().describe('Page number'),
        size: z.number().optional().describe('Page size'),
      },
    },
    async ({ page = 1, size = 20 }: { page?: number; size?: number }) => {
      const result = await callBff('GET', '/api/users', undefined, { params: { page, size } });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'user_create',
    {
      description: 'user create',
      inputSchema: {
        email: z.string().email().describe('User email'),
        role: z.string().describe('User role'),
        name: z.string().optional().describe('User display name'),
      },
    },
    async ({ email, role, name }: { email: string; role: string; name?: string }) => {
      const result = await callBff('POST', '/api/users', { email, role, name });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'user_get',
    {
      description: 'user get',
      inputSchema: {
        userId: z.string().describe('User ID'),
      },
    },
    async ({ userId }: { userId: string }) => {
      const result = await callBff('GET', `/api/users/${userId}`);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'user_updateStatus',
    {
      description: 'user updateStatus',
      inputSchema: {
        userId: z.string().describe('User ID'),
        status: z.string().describe('New user status'),
      },
    },
    async ({ userId, status }: { userId: string; status: string }) => {
      const result = await callBff('PUT', `/api/users/${userId}/status`, { status });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'user_delete',
    {
      description: 'user delete',
      inputSchema: {
        userId: z.string().describe('User ID'),
      },
    },
    async ({ userId }: { userId: string }) => {
      const result = await callBff('DELETE', `/api/users/${userId}`, undefined);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}

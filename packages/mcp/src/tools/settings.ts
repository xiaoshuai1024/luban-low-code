import type { McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v3';
import { callBff } from '../lib/bff-client.js';

export function registerSettingsTools(server: McpServer): void {
  server.registerTool(
    'settings_get',
    {
      description: 'settings get',
      inputSchema: {

      },
    },
    async ({  }: {  }) => {
      const result = await callBff('GET', `/api/settings`);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'settings_update',
    {
      description: 'settings update',
      inputSchema: {
        data: z.record(z.unknown()).describe('Settings data')
      },
    },
    async ({ data }: { data: Record<string, unknown> }) => {
      const result = await callBff('PUT', `/api/settings`, { ...data });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}

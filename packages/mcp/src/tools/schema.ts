import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v3';
import { validatePageSchema } from '../lib/schema-validator.js';

export function registerSchemaTools(server: McpServer): void {
  server.registerTool(
    'schema_validate',
    {
      description: '校验页面 Schema 是否符合 Luban 结构规则。页面创建前可调用此工具预校验。',
      inputSchema: { schema: z.any().describe('完整的 PageSchema JSON 对象') },
    },
    async (args) => {
      const result = validatePageSchema((args as { schema?: unknown }).schema);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}

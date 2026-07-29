import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v3';
import { callBff } from '../lib/bff-client.js';

export function registerFormTools(server: McpServer): void {
  server.registerTool(
    'form_list',
    {
      description: '获取站点下的表单列表',
      inputSchema: {
        siteId: z.string().describe('站点 ID'),
        page: z.number().optional().describe('页码'),
        size: z.number().optional().describe('每页数量'),
      },
    },
    async ({ siteId, page = 1, size = 20 }: { siteId: string; page?: number; size?: number }) => {
      const result = await callBff('GET', '/api/forms', undefined, { params: { siteId, page, size } });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'form_create',
    {
      description: '创建表单',
      inputSchema: {
        config: z.record(z.unknown()).describe('Form configuration'),
      },
    },
    async ({ config }: { config: Record<string, unknown> }) => {
      const result = await callBff('POST', '/api/forms', config);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'form_get',
    {
      description: '获取表单详情',
      inputSchema: {
        formId: z.string().describe('表单 ID'),
        siteId: z.string().describe('站点 ID'),
      },
    },
    async ({ formId, siteId }: { formId: string; siteId: string }) => {
      const result = await callBff('GET', `/api/forms/${formId}`, undefined, { params: { siteId } });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'form_submit',
    {
      description: '提交表单数据',
      inputSchema: {
        formId: z.string().describe('form Id'),
        data: z.record(z.unknown()).describe('Form submission data'),
      },
    },
    async ({ formId, data }: { formId: string; data: Record<string, unknown> }) => {
      const result = await callBff('POST', `/api/forms/${formId}/submit`, data);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}

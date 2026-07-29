import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v3';
import { callBff } from '../lib/bff-client.js';

export function registerLeadTools(server: McpServer): void {
  server.registerTool(
    'lead_list',
    {
      description: '获取线索列表（需 siteId）',
      inputSchema: {
        siteId: z.string().describe('站点 ID'),
        status: z.string().optional().describe('筛选状态'),
        formId: z.string().optional().describe('筛选表单'),
        page: z.number().optional().describe('页码'),
        size: z.number().optional().describe('每页数量'),
      },
    },
    async ({ siteId, status, formId, page, size }: { siteId: string; status?: string; formId?: string; page?: number; size?: number }) => {
      const params: Record<string, unknown> = { siteId };
      if (status) params.status = status;
      if (formId) params.formId = formId;
      if (page) params.page = page;
      if (size) params.size = size;
      const result = await callBff('GET', '/api/leads', undefined, { params });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'lead_get',
    {
      description: '获取线索详情',
      inputSchema: {
        leadId: z.string().describe('线索 ID'),
        siteId: z.string().describe('站点 ID'),
      },
    },
    async ({ leadId, siteId }: { leadId: string; siteId: string }) => {
      const result = await callBff('GET', `/api/leads/${leadId}`, undefined, { params: { siteId } });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'lead_updateStatus',
    {
      description: '更新线索状态',
      inputSchema: {
        leadId: z.string().describe('线索 ID'),
        siteId: z.string().describe('站点 ID'),
        status: z.string().describe('新状态'),
      },
    },
    async ({ leadId, siteId, status }: { leadId: string; siteId: string; status: string }) => {
      const result = await callBff('PUT', `/api/leads/${leadId}/status`, { status, siteId });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'lead_export',
    {
      description: '导出线索',
      inputSchema: {
        siteId: z.string().describe('站点 ID'),
        format: z.enum(['csv', 'json']).optional().describe('导出格式'),
      },
    },
    async ({ siteId, format }: { siteId: string; format?: string }) => {
      const result = await callBff('GET', '/api/leads/export', undefined, { params: { siteId, format } });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}

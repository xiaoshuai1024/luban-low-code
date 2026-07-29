import type { McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v3';
import { callBff } from '../lib/bff-client.js';

export function registerSiteTools(server: McpServer): void {
  server.registerTool(
    'site_list',
    {
      description: 'site list',
      inputSchema: {
        page: z.number().describe('page number').optional(),
        size: z.number().describe('page size').optional(),
      },
    },
    async ({ page = 1, size = 20 }: { page?: number, size?: number }) => {
      const result = await callBff('GET', `/api/sites`, undefined, { params: { page, size } });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'site_get',
    {
      description: 'site get',
      inputSchema: {
        siteId: z.string().describe('site Id'),
      },
    },
    async ({ siteId }: { siteId: string }) => {
      const result = await callBff('GET', `/api/sites/${siteId}`);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'site_create',
    {
      description: 'site create',
      inputSchema: {
        data: z.record(z.unknown()).describe('site data'),
      },
    },
    async ({ data }: { data: Record<string, unknown> }) => {
      const result = await callBff('POST', `/api/sites`, { ...data });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'site_update',
    {
      description: 'site update',
      inputSchema: {
        siteId: z.string().describe('site Id'),
        data: z.record(z.unknown()).describe('site data'),
      },
    },
    async ({ siteId, data }: { siteId: string; data: Record<string, unknown> }) => {
      // Fetch current site to fill ALL required fields
      const current = await callBff<Record<string, unknown>>('GET', `/api/sites/${siteId}`);
      const body: Record<string, unknown> = {
        name: current.name,
        slug: current.slug,
        base_url: current.baseUrl || current.base_url || '',
        status: current.status || 'active',
        seo: current.seo || null,
        analytics: current.analytics || null,
        ...data,
      };
      const result = await callBff('PUT', `/api/sites/${siteId}`, body);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'site_delete',
    {
      description: 'delete site',
      inputSchema: {
        siteId: z.string().describe('site Id'),
      },
    },
    async ({ siteId }: { siteId: string }) => {
      const result = await callBff('DELETE', `/api/sites/${siteId}`, undefined);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}

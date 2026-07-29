import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v3';
import { callBff } from '../lib/bff-client.js';

/**
 * Register version-related tools.
 *
 * BFF API mapping (sites/{id}/pages/{pid}/versions):
 *   versions_list:     GET  /api/sites/{id}/pages/{pid}/versions            → { items: Version[], total }
 *   versions_get:      GET  /api/sites/{id}/pages/{pid}/versions/{vid}      → Version
 *   versions_rollback: POST /api/sites/{id}/pages/{pid}/versions/{vid}/rollback → Page (admin only)
 */
export function registerVersionTools(server: McpServer): void {
  // ── versions_list ────────────────────────────────────────────────────
  server.registerTool(
    'versions_list',
    {
      description: '获取页面的版本历史列表',
      inputSchema: {
        siteId: z.string().describe('站点 ID'),
        pageId: z.string().describe('页面 ID'),
        page: z.number().int().positive().optional().describe('页码（从 1 开始）'),
        size: z.number().int().positive().optional().describe('每页条数'),
      },
    },
    async ({ siteId, pageId, page, size }) => {
      const params = new URLSearchParams();
      if (page !== undefined) params.set('page', String(page));
      if (size !== undefined) params.set('size', String(size));
      const qs = params.toString();
      const path = `/api/sites/${siteId}/pages/${pageId}/versions${qs ? '?' + qs : ''}`;
      const result = await callBff<{ items: unknown[]; total: number }>('GET', path);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );

  // ── versions_get ─────────────────────────────────────────────────────
  server.registerTool(
    'versions_get',
    {
      description: '获取指定版本的页面 schema 详情',
      inputSchema: {
        siteId: z.string().describe('站点 ID'),
        pageId: z.string().describe('页面 ID'),
        versionId: z.string().describe('版本 ID'),
      },
    },
    async ({ siteId, pageId, versionId }) => {
      const result = await callBff<unknown>(
        'GET',
        `/api/sites/${siteId}/pages/${pageId}/versions/${versionId}`,
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );

  // ── versions_rollback (admin only) ───────────────────────────────────
  server.registerTool(
    'versions_rollback',
    {
      description: '回滚到指定版本 (admin only)',
      inputSchema: {
        siteId: z.string().describe('站点 ID'),
        pageId: z.string().describe('页面 ID'),
        versionId: z.string().describe('版本 ID'),
      },
    },
    async ({ siteId, pageId, versionId }) => {
      const result = await callBff<unknown>(
        'POST',
        `/api/sites/${siteId}/pages/${pageId}/versions/${versionId}/rollback`,
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );
}

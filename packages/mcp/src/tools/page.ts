import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v3';
import { callBff } from '../lib/bff-client.js';

/**
 * Register page-related tools.
 *
 * BFF API mapping:
 *   page_list:    GET    /api/sites/{siteId}/pages?page=&size=   → { items: Page[], total }
 *   page_create:  POST   /api/sites/{siteId}/pages               → Page
 *   page_get:     GET    /api/sites/{siteId}/pages/{pageId}      → Page
 *   page_update:  PUT    /api/sites/{siteId}/pages/{pageId}      → Page
 *   page_delete:  DELETE /api/sites/{siteId}/pages/{pageId}      → void
 *   page_publish: POST   /api/sites/{siteId}/pages/{pageId}/publish → Page
 */
export function registerPageTools(server: McpServer): void {
  // ── page_list ──────────────────────────────────────────────────────
  server.registerTool(
    'page_list',
    {
      description: '获取页面列表',
      inputSchema: {
        siteId: z.string().describe('站点 ID'),
        page: z.number().int().positive().optional().describe('页码（从 1 开始）'),
        size: z.number().int().positive().optional().describe('每页条数'),
      },
    },
    async ({ siteId, page, size }: { siteId: string; page?: number; size?: number }) => {
      const params = new URLSearchParams();
      if (page !== undefined) params.set('page', String(page));
      if (size !== undefined) params.set('size', String(size));
      const qs = params.toString();
      const path = `/api/sites/${siteId}/pages${qs ? '?' + qs : ''}`;
      const result = await callBff<{ items: unknown[]; total: number }>('GET', path);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── page_create ────────────────────────────────────────────────────
  server.registerTool(
    'page_create',
    {
      description: '创建新页面。name 为页面名称，path 为 URL 路径（如 /welcome），schema 为页面 JSON schema，status 可选（draft/published）',
      inputSchema: {
        siteId: z.string().describe('站点 ID'),
        name: z.string().describe('页面名称'),
        path: z.string().describe('页面路径，如 /welcome'),
        schema: z.any().describe('页面 schema JSON'),
        status: z.string().optional().describe('状态：draft（草稿）/published（已发布）'),
      },
    },
    async ({ siteId, name, path, schema, status }: { siteId: string; name: string; path: string; schema: unknown; status?: string }) => {
      const body: Record<string, unknown> = { name, path, schema };
      if (status !== undefined) body.status = status;
      const result = await callBff('POST', `/api/sites/${siteId}/pages`, body);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── page_get ───────────────────────────────────────────────────────
  server.registerTool(
    'page_get',
    {
      description: '获取页面详细信息（含 schema）',
      inputSchema: {
        siteId: z.string().describe('站点 ID'),
        pageId: z.string().describe('页面 ID'),
      },
    },
    async ({ siteId, pageId }: { siteId: string; pageId: string }) => {
      const result = await callBff('GET', `/api/sites/${siteId}/pages/${pageId}`);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── page_update ────────────────────────────────────────────────────
  server.registerTool(
    'page_update',
    {
      description: '更新页面',
      inputSchema: {
        siteId: z.string().describe('站点 ID'),
        pageId: z.string().describe('页面 ID'),
        name: z.string().optional().describe('新的页面名称'),
        path: z.string().optional().describe('新的页面路径'),
        schema: z.any().optional().describe('更新的页面 schema'),
        status: z.string().optional().describe('新的状态'),
      },
    },
    async ({ siteId, pageId, name, path, schema, status }: { siteId: string; pageId: string; name?: string; path?: string; schema?: unknown; status?: string }) => {
      // Fetch current page to fill in required fields if not provided
      const page = await callBff<Record<string, unknown>>('GET', `/api/sites/${siteId}/pages/${pageId}`);
      const body: Record<string, unknown> = {
        name: name ?? page.name,
        path: path ?? page.path,
      };
      if (schema !== undefined) body.schema = schema;
      if (status !== undefined) body.status = status;
      const result = await callBff('PUT', `/api/sites/${siteId}/pages/${pageId}`, body);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── page_delete ────────────────────────────────────────────────────
  server.registerTool(
    'page_delete',
    {
      description: '删除页面',
      inputSchema: {
        siteId: z.string().describe('站点 ID'),
        pageId: z.string().describe('页面 ID'),
      },
    },
    async ({ siteId, pageId }: { siteId: string; pageId: string }) => {
      const result = await callBff('DELETE', `/api/sites/${siteId}/pages/${pageId}`, undefined);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── page_publish ──────────────────────────────────────────────────
  server.registerTool(
    'page_publish',
    {
      description: '发布页面（将页面状态设为 published）',
      inputSchema: {
        siteId: z.string().describe('站点 ID'),
        pageId: z.string().describe('页面 ID'),
      },
    },
    async ({ siteId, pageId }: { siteId: string; pageId: string }) => {
      // First fetch current page to get required name/path fields
      const page = await callBff<Record<string, unknown>>('GET', `/api/sites/${siteId}/pages/${pageId}`);
      const result = await callBff('PUT', `/api/sites/${siteId}/pages/${pageId}`, {
        name: page.name,
        path: page.path,
        status: 'published',
      });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}

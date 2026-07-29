import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v3';
import { callBff } from '../lib/bff-client.js';

export function registerCollectionTools(server: McpServer): void {
  server.registerTool(
    'collection_list',
    {
      description: '获取站点下的数据集合列表',
      inputSchema: {
        siteId: z.string().describe('站点 ID'),
        page: z.number().optional().describe('页码'),
        size: z.number().optional().describe('每页数量'),
      },
    },
    async ({ siteId, page = 1, size = 20 }: { siteId: string; page?: number; size?: number }) => {
      const result = await callBff('GET', '/api/collections', undefined, { params: { siteId, page, size } });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'collection_create',
    {
      description: '创建数据集合',
      inputSchema: {
        siteId: z.string().describe('站点 ID'),
        name: z.string().describe('Collection name'),
        schema: z.record(z.unknown()).optional().describe('Collection schema'),
      },
    },
    async ({ siteId, name, schema }: { siteId: string; name: string; schema?: Record<string, unknown> }) => {
      const result = await callBff('POST', '/api/collections', { siteId, name, schema });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'collection_get',
    {
      description: '获取集合详情',
      inputSchema: {
        collectionId: z.string().describe('集合 ID'),
        siteId: z.string().describe('站点 ID'),
      },
    },
    async ({ collectionId, siteId }: { collectionId: string; siteId: string }) => {
      const result = await callBff('GET', `/api/collections/${collectionId}`, undefined, { params: { siteId } });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'collection_delete',
    {
      description: '删除集合',
      inputSchema: {
        collectionId: z.string().describe('集合 ID'),
        siteId: z.string().describe('站点 ID'),
      },
    },
    async ({ collectionId, siteId }: { collectionId: string; siteId: string }) => {
      const result = await callBff('DELETE', `/api/collections/${collectionId}`, undefined, { params: { siteId } });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'collection_query',
    {
      description: '查询集合中的数据',
      inputSchema: {
        collectionId: z.string().describe('集合 ID'),
        siteId: z.string().describe('站点 ID'),
        page: z.number().optional().describe('页码'),
        size: z.number().optional().describe('每页数量'),
      },
    },
    async ({ collectionId, siteId, page = 1, size = 20 }: { collectionId: string; siteId: string; page?: number; size?: number }) => {
      const result = await callBff('GET', `/api/collections/${collectionId}/items`, undefined, { params: { siteId, page, size } });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'collection_addItem',
    {
      description: '添加集合数据项',
      inputSchema: {
        collectionId: z.string().describe('集合 ID'),
        siteId: z.string().describe('站点 ID'),
        data: z.record(z.unknown()).describe('Item data'),
      },
    },
    async ({ collectionId, siteId, data }: { collectionId: string; siteId: string; data: Record<string, unknown> }) => {
      const result = await callBff('POST', `/api/collections/${collectionId}/items`, { ...data }, { params: { siteId } });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'collection_deleteItem',
    {
      description: '删除集合数据项',
      inputSchema: {
        collectionId: z.string().describe('集合 ID'),
        siteId: z.string().describe('站点 ID'),
        itemId: z.string().describe('item Id'),
      },
    },
    async ({ collectionId, siteId, itemId }: { collectionId: string; siteId: string; itemId: string }) => {
      const result = await callBff('DELETE', `/api/collections/${collectionId}/items/${itemId}`, undefined, { params: { siteId } });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}

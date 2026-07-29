import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v3';
import { callBff } from '../lib/bff-client.js';

export function registerDatasourceTools(server: McpServer): void {
  server.registerTool(
    'datasource_list',
    {
      description: '获取数据源列表',
      inputSchema: {
        siteId: z.string().describe('站点 ID'),
        page: z.number().optional().describe('页码'),
        size: z.number().optional().describe('每页数量'),
      },
    },
    async ({ siteId, page = 1, size = 20 }: { siteId: string; page?: number; size?: number }) => {
      const result = await callBff('GET', `/api/datasources`, undefined, { params: { siteId, page, size } });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'datasource_create',
    {
      description: '创建数据源',
      inputSchema: {
        siteId: z.string().describe('站点 ID'),
        type: z.string().describe('Datasource type'),
        config: z.record(z.unknown()).describe('Datasource configuration'),
      },
    },
    async ({ siteId, type, config }: { siteId: string; type: string; config: Record<string, unknown> }) => {
      const result = await callBff('POST', `/api/datasources`, { siteId, type, config });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'datasource_get',
    {
      description: '获取数据源详情',
      inputSchema: {
        datasourceId: z.string().describe('datasource Id'),
        siteId: z.string().describe('站点 ID'),
      },
    },
    async ({ datasourceId, siteId }: { datasourceId: string; siteId: string }) => {
      const result = await callBff('GET', `/api/datasources/${datasourceId}`, undefined, { params: { siteId } });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'datasource_update',
    {
      description: '更新数据源',
      inputSchema: {
        datasourceId: z.string().describe('datasource Id'),
        siteId: z.string().describe('站点 ID'),
        type: z.string().optional().describe('Datasource type'),
        config: z.record(z.unknown()).optional().describe('Updated configuration'),
      },
    },
    async ({ datasourceId, siteId, type, config }: { datasourceId: string; siteId: string; type?: string; config?: Record<string, unknown> }) => {
      const result = await callBff('PUT', `/api/datasources/${datasourceId}`, { siteId, type, config });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'datasource_delete',
    {
      description: '删除数据源',
      inputSchema: {
        datasourceId: z.string().describe('datasource Id'),
        siteId: z.string().describe('站点 ID'),
      },
    },
    async ({ datasourceId, siteId }: { datasourceId: string; siteId: string }) => {
      const result = await callBff('DELETE', `/api/datasources/${datasourceId}`, undefined, { params: { siteId } });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'datasource_test',
    {
      description: '测试数据源连接',
      inputSchema: {
        datasourceId: z.string().describe('datasource Id'),
        siteId: z.string().describe('站点 ID'),
        config: z.record(z.unknown()).optional().describe('Test configuration'),
      },
    },
    async ({ datasourceId, siteId, config }: { datasourceId: string; siteId: string; config?: Record<string, unknown> }) => {
      const result = await callBff('POST', `/api/datasources/${datasourceId}/test`, config, { params: { siteId } });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'datasource_query',
    {
      description: '查询数据源',
      inputSchema: {
        datasourceId: z.string().describe('datasource Id'),
        siteId: z.string().describe('站点 ID'),
        query: z.record(z.unknown()).describe('Query parameters'),
        page: z.number().optional().describe('Page number'),
        size: z.number().optional().describe('Page size'),
      },
    },
    async ({ datasourceId, siteId, query, page, size }: { datasourceId: string; siteId: string; query: Record<string, unknown>; page?: number; size?: number }) => {
      const result = await callBff('POST', `/api/datasources/${datasourceId}/query`, { query, page, size }, { params: { siteId } });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v3';
import { getAuthUser, getTokenExpiresAt, getToken } from '../auth.js';

/**
 * Register the auth_status tool.
 * Returns { authenticated, userId, username, role, tokenExpiresAt }.
 */
export function registerAuthTools(server: McpServer): void {
  server.registerTool(
    'auth_status',
    {
      description: '返回当前认证状态：是否已登录、用户 ID、用户名、角色、JWT 过期时间（纯本地信息，无 HTTP 调用）',
    },
    async () => {
      const token = getToken();
      if (!token) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ authenticated: false }, null, 2),
            },
          ],
        };
      }

      const user = getAuthUser();
      const tokenExpiresAt = getTokenExpiresAt();

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                authenticated: true,
                userId: user?.userId ?? null,
                username: user?.username ?? null,
                role: user?.role ?? null,
                tokenExpiresAt,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}

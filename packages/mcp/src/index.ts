import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { initialize } from './auth.js';

// Tool registration modules
import { registerAuthTools } from './tools/auth.js';
import { registerCollectionTools } from './tools/collection.js';
import { registerDatasourceTools } from './tools/datasource.js';
import { registerFormTools } from './tools/form.js';
import { registerLeadTools } from './tools/lead.js';
import { registerPageTools } from './tools/page.js';
import { registerPublicTools } from './tools/public.js';
import { registerSchemaTools } from './tools/schema.js';
import { registerSettingsTools } from './tools/settings.js';
import { registerSiteTools } from './tools/site.js';
import { registerUserTools } from './tools/user.js';
import { registerVersionTools } from './tools/version.js';

// Resource modules
import { setupResourceHandlers } from './resources/lib/resource-registry.js';
import { schemaRulesResource } from './resources/schema-rules.js';
import { materialCatalogResource, materialDetailTemplate } from './resources/material-catalog.js';
import { pageTemplatesResource } from './resources/page-templates.js';
import { bestPracticesResource } from './resources/best-practices.js';
import { siteAnalyticsGuideResource } from './resources/site-analytics-guide.js';

// Prompt modules
import { registerSystemPrompt } from './prompts/system-prompt.js';

// Load .env file
import 'dotenv/config';

const server = new McpServer(
  {
    name: '@luban-low-code/mcp-server',
    version: '0.0.1',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  },
);

// ── Register all tools ────────────────────────────────────────────────

registerAuthTools(server);
registerCollectionTools(server);
registerDatasourceTools(server);
registerFormTools(server);
registerLeadTools(server);
registerPageTools(server);
registerPublicTools(server);
registerSchemaTools(server);
registerSettingsTools(server);
registerSiteTools(server);
registerUserTools(server);
registerVersionTools(server);

// ── Register all resources ────────────────────────────────────────────

setupResourceHandlers(
  server.server,
  [
    schemaRulesResource,
    materialCatalogResource,
    pageTemplatesResource,
    bestPracticesResource,
    siteAnalyticsGuideResource,
  ],
  [
    materialDetailTemplate,
  ],
);

// ── Register system prompt ────────────────────────────────────────────

registerSystemPrompt(server);

// ── Main ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  try {
    // Authenticate with BFF before starting the server
    await initialize();

    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error('@luban-low-code/mcp-server started successfully');
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main();

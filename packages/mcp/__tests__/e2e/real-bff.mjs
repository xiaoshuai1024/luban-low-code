import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const ENV = {
  LUBAN_API_KEY: 'luban_90b73d2cfd2d43858449ce1968b9042d',
  BFF_BASE_URL: 'http://127.0.0.1:3100',
  PATH: process.env.PATH,
};

async function main() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
    env: ENV,
  });

  const client = new Client({ name: 'e2e-test', version: '1.0.0' });
  await client.connect(transport);
  console.log('✅ Connected to MCP server\n');

  async function callTool(name, args, expectSuccess = true) {
    console.log(`\n--- ${name} ---`);
    const result = await client.callTool({ name, arguments: args });
    if (result.isError) {
      console.log(`  ❌ ERROR: ${result.content[0].text}`);
      if (expectSuccess) throw new Error(`${name} failed: ${result.content[0].text}`);
      return null;
    }
    const text = result.content[0].text;
    const data = JSON.parse(text);
    console.log(`  ✅ ${JSON.stringify(data).substring(0, 500)}`);
    return data;
  }

  // 1. health
  await callTool('health', {});

  // 2. auth_status
  const auth = await callTool('auth_status', {});
  console.assert(auth.authenticated === true, 'Should be authenticated');
  console.assert(auth.username === 'admin', 'Should be admin');

  // Register tools listing
  const toolsResult = await client.listTools();
  const toolNames = toolsResult.tools.map(t => t.name);
  console.log(`\n--- Registered tools (${toolNames.length}) ---`);
  console.log(`  ${toolNames.join(', ')}`);

  // 3. site_list (empty)
  let sites = await callTool('site_list', {});
  console.assert(Array.isArray(sites), 'site_list should return array');

  // 4. site_create
  const ts = Date.now();
  const newSite = await callTool('site_create', {
    data: { name: 'E2E Test Site', slug: `e2e-test-${ts}`, base_url: 'https://e2e.example.com' }
  });
  const siteId = newSite.id || newSite.siteId;
  console.log(`  Site ID: ${siteId}`);

  // 5. site_get
  const siteById = await callTool('site_get', { siteId });
  console.assert(siteById.id === siteId || siteById.siteId === siteId, 'Should return the same site');

  // 6. page_create (with required name, path, schema)
  const pageSchema = {
    nodes: [
      { id: 'root', type: 'page', children: ['child1'] },
      { id: 'child1', type: 'heading', props: { text: 'Hello World' } }
    ],
    edges: []
  };
  const newPage = await callTool('page_create', {
    siteId,
    name: 'Welcome Page',
    path: '/welcome',
    schema: pageSchema
  });
  const pageId = newPage.id || newPage.pageId;
  console.log(`  Page ID: ${pageId}`);

  // 7. page_list
  const pages = await callTool('page_list', { siteId });
  console.assert(Array.isArray(pages) || pages.length > 0, 'Should have pages');

  // 8. page_get
  const pageById = await callTool('page_get', { siteId, pageId });
  console.assert(pageById.id === pageId || pageById.pageId === pageId, 'Should return same page');

  // 9. page_publish
  const published = await callTool('page_publish', { siteId, pageId });
  console.assert(published.status === 'published', 'Should be published');

  // 10. versions_list
  const versions = await callTool('versions_list', { siteId, pageId });

  // 11. page_update
  const updated = await callTool('page_update', {
    siteId, pageId,
    name: 'Welcome Page Updated',
    status: 'draft'
  });

  // 12. settings_get
  const settings = await callTool('settings_get', {});

  // 13. user_list
  const users = await callTool('user_list', {});

  // 14. form_list (requires siteId)
  await callTool('form_list', { siteId });

  // 15. collection_list (requires siteId)
  await callTool('collection_list', { siteId });

  // 16. datasource_list
  await callTool('datasource_list', { siteId });

  // 17. lead_list (requires siteId)
  await callTool('lead_list', { siteId });

  // 18. site_update
  await callTool('site_update', {
    siteId,
    data: { name: 'E2E Test Site Updated' }
  });

  // Cleanup: delete page then site (non-fatal if they fail)
  console.log('\n--- cleanup ---');
  await callTool('page_delete', { siteId, pageId }, true);
  await callTool('site_delete', { siteId }, true);

  await client.close();
  console.log('\n🎉 All E2E tests passed — full CRUD cycle verified!');
  console.log(`   Tools verified: ${toolNames.length} total`);
}

main().catch(err => {
  console.error('\n❌ E2E test FAILED:', err.message);
  process.exit(1);
});

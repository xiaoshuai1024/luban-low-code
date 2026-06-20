import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';

/**
 * AI 助手面板 E2E（plan P1-T10 / P2-T4）。
 *
 * 绑正式路由 /sites/:siteId/pages/:pageId/edit（实际为 /sites/:siteId/pages/:pageId）。
 * 真实登录态，建测试页后进编辑器验证 AI 面板交互。
 *
 * @smoke：AI 助手入口可见、抽屉展开、三 tab（对话/引导/设计稿）渲染 —— 不依赖 AI 服务后端。
 * @core：生成主链路（输入→流式→确认→落地）—— 依赖 AI 服务起齐 + LLM key，不可达则 skip（禁假绿）。
 *
 * AI 服务可达性经 /healthz 探测：未起/不健康 → @core 用例 skip（不伪装通过）。
 */

test.use({ storageState: 'e2e/.auth/user.json' });

const BFF_URL = process.env.LUBAN_E2E_BFF_URL ?? 'http://127.0.0.1:3100';

function readToken(): string {
  try {
    const s = JSON.parse(fs.readFileSync('e2e/.auth/user.json', 'utf8'));
    return s.origins?.[0]?.localStorage?.find((i: { name: string }) => i.name === 'luban_token')?.value ?? '';
  } catch {
    return '';
  }
}

let siteId = '';
let pageId = '';

test.beforeAll(async ({ request }) => {
  const token = readToken();
  if (!token) return;
  // 取第一个 site
  const sitesRes = await request.get(`${BFF_URL}/api/sites`, { headers: { luban_token: token } });
  const sites = await sitesRes.json().catch(() => []);
  siteId = Array.isArray(sites) && sites.length ? sites[0].id : '';
  if (!siteId) return;
  // 建一个测试页用于 AI 面板交互
  const createRes = await request.post(`${BFF_URL}/api/sites/${siteId}/pages`, {
    headers: { luban_token: token, 'Content-Type': 'application/json' },
    data: {
      name: `ai-e2e-${Date.now()}`,
      path: `/ai-e2e-${Date.now()}`,
      schema: { root: { id: 'root', type: 'LubanContainer', props: {}, children: [] } },
    },
  });
  if (createRes.ok()) {
    const body = await createRes.json().catch(() => null);
    pageId = body?.id ?? (body?.data?.id ?? '');
  }
});

test.afterAll(async ({ request }) => {
  // 清理测试页
  const token = readToken();
  if (siteId && pageId && token) {
    await request.delete(`${BFF_URL}/api/sites/${siteId}/pages/${pageId}`, {
      headers: { luban_token: token },
    }).catch(() => {});
  }
});

test.describe('AI 助手面板 @smoke', () => {
  test.skip(({ }) => !siteId || !pageId, '须有至少一个站点 + 可建测试页');

  test('编辑器显示 AI 助手入口且可展开抽屉', async ({ page }) => {
    await page.goto(`/sites/${siteId}/pages/${pageId}`);
    // 等待编辑器加载（meta 表单可见）
    await expect(page.getByText('页面名称')).toBeVisible({ timeout: 15000 });

    // AI 助手入口按钮（FeatureGate ai.assistant 开则可见）
    const aiBtn = page.getByRole('button', { name: /AI 助手/ });
    // 若 FeatureGate 关（环境未开启），入口不渲染 —— 此处断言可见要求默认开启
    await expect(aiBtn).toBeVisible({ timeout: 10000 });
    await aiBtn.click();

    // 抽屉展开，三 tab 可见
    await expect(page.getByRole('tab', { name: '对话' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tab', { name: '引导' })).toBeVisible();
    // 设计稿 tab 受 FeatureGate ai.design_to_page 控制（默认开）
    await expect(page.getByRole('tab', { name: '设计稿' })).toBeVisible();

    // 对话输入框可见
    await expect(page.getByPlaceholder(/描述你想要的页面/)).toBeVisible();
  });

  test('引导 tab 展示建议（FeatureGate ai.guidance 开）', async ({ page }) => {
    await page.goto(`/sites/${siteId}/pages/${pageId}`);
    await expect(page.getByText('页面名称')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /AI 助手/ }).click();
    await page.getByRole('tab', { name: '引导' }).click();
    // 引导 tab 内容区渲染（建议卡片或空态，取决于 AI 服务是否起齐）
    await expect(page.getByRole('tabpanel', { name: '引导' })).toBeVisible({ timeout: 10000 });
  });
});

test.describe('AI 生成主链路 @core', () => {
  // 依赖 AI 服务起齐 + LLM key；不可达则 skip（禁假绿 plan §7.2）
  test.skip(async ({ request }) => {
    try {
      const res = await request.get(`${BFF_URL.replace(':3100', ':8000')}/healthz`, { timeout: 3000 });
      if (!res.ok()) return true;
      const body = await res.json();
      return body?.status !== 'ok';
    } catch {
      return true; // AI 服务未起 → skip
    }
  }, 'AI 服务未起齐（需 docker compose up 6 容器 + LLM key）');

  test('自然语言生成页面 → 确认 → 落地画布', async ({ page }) => {
    await page.goto(`/sites/${siteId}/pages/${pageId}`);
    await expect(page.getByText('页面名称')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /AI 助手/ }).click();

    const input = page.getByPlaceholder(/描述你想要的页面/);
    await input.fill('做一个简单的用户列表页');
    await input.press('Enter');

    // 流式进度或终态确认出现（等待生成完成）
    const confirmBtn = page.getByRole('button', { name: '应用到画布' });
    await expect(confirmBtn).toBeVisible({ timeout: 60000 });

    // 应用到画布
    await confirmBtn.click();
    // 成功提示
    await expect(page.getByText(/已应用到画布/)).toBeVisible({ timeout: 10000 });
  });

  test('设计稿转页面（拖入图片 → 对照预览 → 确认）', async ({ page }) => {
    test.skip(({ }) => !fs.existsSync('e2e/fixtures/sample-design.png'), '须有设计稿样本图 e2e/fixtures/sample-design.png');
    await page.goto(`/sites/${siteId}/pages/${pageId}`);
    await expect(page.getByText('页面名称')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /AI 助手/ }).click();
    await page.getByRole('tab', { name: '设计稿' }).click();

    // 上传设计稿图片（ setInputFiles 触发 input change）
    const fileInput = page.locator('input[type=file]').last();
    await fileInput.setInputFiles('e2e/fixtures/sample-design.png');

    // 等待对照预览 + 确认按钮
    const confirmBtn = page.getByRole('button', { name: '应用到画布' });
    await expect(confirmBtn).toBeVisible({ timeout: 90000 });
    await confirmBtn.click();
    await expect(page.getByText(/已应用到画布/)).toBeVisible({ timeout: 10000 });
  });
});

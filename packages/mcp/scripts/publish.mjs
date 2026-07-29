#!/usr/bin/env node

/**
 * @luban/mcp-server — npm publish helper
 *
 * 加载项目根 .env（含 NPM_TOKEN），然后调用 `npm publish`。
 *
 * 用法：cd packages/mcp && node scripts/publish.mjs
 *      或  pnpm run publish:npm
 *
 * 首次发布前确保：
 *   1. 项目根 .env 中填入真实的 NPM_TOKEN（从 https://www.npmjs.com/settings/tokens 创建）
 *   2. pnpm run build 通过
 *   3. npm publish --dry-run 预览发布内容
 */

import dotenv from 'dotenv';
import { execSync } from 'child_process';
import path from 'path';

// ── 从 git 根目录加载 .env ──────────────────────────────────
try {
  // 使用 --git-common-dir 而非 --show-toplevel，以兼容 git worktree 场景
  const gitDir = execSync('git rev-parse --git-common-dir', { encoding: 'utf-8' }).trim();
  const repoRoot = path.dirname(gitDir);
  dotenv.config({ path: path.join(repoRoot, '.env') });
} catch {
  // fallback: 从 cwd 向上搜索 .env
  import('dotenv/config');
}

// ── 校验 NPM_TOKEN ─────────────────────────────────────────
const token = process.env.NPM_TOKEN || '';
if (!token || token === 'npm_在这里粘贴你的token') {
  console.error();
  console.error('❌ NPM_TOKEN 未设置或仍为占位值。');
  console.error('   请在项目根目录 .env 中填入真实的 npm token：');
  console.error('   NPM_TOKEN=npm_你的真实token');
  console.error('   从 https://www.npmjs.com/settings/tokens 创建。');
  console.error();
  process.exit(1);
}

// ── 发布 ───────────────────────────────────────────────────
console.log('📦 发布 @luban-low-code/mcp-server...');
execSync('npm publish', { stdio: 'inherit' });
console.log('✅ @luban-low-code/mcp-server 发布成功！');

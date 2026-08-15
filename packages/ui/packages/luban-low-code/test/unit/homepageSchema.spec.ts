import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount } from '@vue/test-utils';
// 物料注册副作用：RuntimeRenderer 经 registry 解析组件，营销物料（navbar/hero 等）
// 仅在 materials barrel 注册后可用（包入口 src/index.ts 同理 import './materials'）。
import '../../src/materials';
import LubanPage from '../../src/lib/LubanPage.vue';
import type { PageSchema } from '../../src/lib/schema';

/**
 * 官网 default 站点主页 schema（deploy/seed/default-homepage.json）渲染校验。
 * 防止物料改名/props 变更后 seed schema 与物料库脱节（渲染出空分区）。
 */
describe('官网主页 schema 渲染', () => {
  // JSON 在包外（monorepo deploy/seed），vite import 分析不支持，运行时读取。
  // cwd 可能是 packages/ui（nx test）、包根（4 级深）或测试直跑，依次尝试。
  const candidates = [
    '../../../deploy/seed/default-homepage.json',
    '../../../../deploy/seed/default-homepage.json',
    '../../deploy/seed/default-homepage.json',
  ];
  const jsonPath = candidates.map((p) => resolve(process.cwd(), p)).find((p) => existsSync(p));
  if (!jsonPath) throw new Error(`找不到 default-homepage.json（cwd=${process.cwd()}）`);
  const schema: PageSchema = JSON.parse(readFileSync(jsonPath, 'utf8'));

  it('七个分区（navbar/hero/stats/features/components/cta/footer）全部渲染并输出锚点 id', () => {
    const wrapper = mount(LubanPage, { props: { schema } });
    for (const anchor of ['navbar', 'hero', 'stats', 'features', 'components', 'cta', 'footer']) {
      expect(wrapper.find(`#${anchor}`).exists(), `分区 #${anchor} 未渲染`).toBe(true);
    }
  });

  it('关键文案渲染（品牌/标题/CTA/版权）', () => {
    const wrapper = mount(LubanPage, { props: { schema } });
    const text = wrapper.text();
    expect(text).toContain('Luban 鲁班');
    expect(text).toContain('像搭积木一样，构建你的应用');
    expect(text).toContain('准备开始了吗？');
    expect(text).toContain('MIT 开源协议');
  });

  it('特性卡片与组件墙数量正确（6 特性 / 30 组件）', () => {
    const wrapper = mount(LubanPage, { props: { schema } });
    const features = wrapper.find('#features').text();
    for (const t of ['可视化搭建', 'SSR 就绪', 'AI 智能生成', '多端适配']) {
      expect(features).toContain(t);
    }
    const comps = wrapper.find('#components').text();
    expect(comps).toContain('Navbar 导航栏');
    expect(comps).toContain('BackToTop 回顶');
  });
});

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanFooter from '../../src/lib/marketing/LubanFooter.vue';

describe('LubanFooter（渐变光条版）', () => {
  const columns = [
    {
      title: '产品',
      links: [
        { label: '核心特性', url: '#features' },
        { label: '组件库', url: '#components' },
      ],
    },
    { title: '资源', links: [{ label: 'GitHub', url: 'https://github.com' }] },
  ];

  it('渲染多列链接与版权', () => {
    const wrapper = mount(LubanFooter, {
      props: { columns, copyright: '© 2026 Luban' },
    });
    expect(wrapper.findAll('.lb-footer__column').length).toBe(2);
    expect(wrapper.findAll('.lb-footer__link').length).toBe(3);
    expect(wrapper.text()).toContain('© 2026 Luban');
  });

  it('链接 href 正确', () => {
    const wrapper = mount(LubanFooter, { props: { columns } });
    expect(wrapper.get('.lb-footer__link').attributes('href')).toBe('#features');
  });

  it('空列不渲染列区块（向后兼容）', () => {
    const wrapper = mount(LubanFooter, { props: { columns: [] } });
    expect(wrapper.find('.lb-footer__columns').exists()).toBe(false);
  });
});

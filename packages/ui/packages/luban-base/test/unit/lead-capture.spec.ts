import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanLeadCapture from '../../src/lib/content/LubanLeadCapture.vue';

describe('LubanLeadCapture（线索采集区块）', () => {
  it('渲染标题/描述/提交按钮默认文案', () => {
    const wrapper = mount(LubanLeadCapture, {
      props: { heading: '预约演示', description: '留下联系方式' },
    });
    expect(wrapper.find('.lb-lead-capture__heading').text()).toBe('预约演示');
    expect(wrapper.find('.lb-lead-capture__description').text()).toBe('留下联系方式');
    expect(wrapper.find('.lb-lead-capture__submit').text()).toBe('提交');
  });

  it('字段开关：默认显示姓名+手机号，不显示邮箱', () => {
    const wrapper = mount(LubanLeadCapture, { props: { heading: 'x' } });
    const inputs = wrapper.findAll('.lb-lead-capture__input--wide, .lb-lead-capture__fields .lb-lead-capture__input');
    const names = inputs.map((i) => i.attributes('name'));
    expect(names).toContain('name');
    expect(names).toContain('phone');
    expect(names).not.toContain('email');
  });

  it('showEmail 开启后渲染邮箱输入', () => {
    const wrapper = mount(LubanLeadCapture, {
      props: { heading: 'x', showEmail: true },
    });
    const email = wrapper.findAll('input[name="email"]');
    expect(email.length).toBe(1);
  });

  it('填手机号提交：emit submit 携带非空字段并进入成功态', async () => {
    const wrapper = mount(LubanLeadCapture, {
      props: { heading: 'x', formId: 'f-1' },
    });
    await wrapper.find('input[name="name"]').setValue('张三');
    await wrapper.find('input[name="phone"]').setValue('13800001111');
    await wrapper.find('input.lb-lead-capture__input--wide').setValue('想了解企业版');
    await wrapper.find('form').trigger('submit.prevent');

    expect(wrapper.emitted('submit')).toHaveLength(1);
    expect(wrapper.emitted('submit')![0][0]).toEqual({
      name: '张三',
      phone: '13800001111',
      message: '想了解企业版',
    });
    // 成功态替换表单
    expect(wrapper.find('.lb-lead-capture__success').exists()).toBe(true);
    expect(wrapper.text()).toContain('提交成功，我们会尽快与您联系');
    expect(wrapper.find('form').exists()).toBe(false);
  });

  it('成功态后再次提交不再 emit（防重复提交）', async () => {
    const wrapper = mount(LubanLeadCapture, { props: { heading: 'x' } });
    await wrapper.find('input[name="phone"]').setValue('13800001111');
    await wrapper.find('form').trigger('submit.prevent');
    expect(wrapper.emitted('submit')).toHaveLength(1);
    // 表单已被成功态替换，无再次提交入口
    expect(wrapper.find('form').exists()).toBe(false);
  });

  it('手机号与邮箱均未填时不 emit（前端必填校验）', async () => {
    const wrapper = mount(LubanLeadCapture, {
      props: { heading: 'x', showEmail: true },
    });
    await wrapper.find('form').trigger('submit.prevent');
    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.find('.lb-lead-capture__success').exists()).toBe(false);
  });

  it('仅填邮箱也可提交（手机/邮箱二选一）', async () => {
    const wrapper = mount(LubanLeadCapture, {
      props: { heading: 'x', showEmail: true },
    });
    await wrapper.find('input[name="email"]').setValue('a@b.com');
    await wrapper.find('form').trigger('submit.prevent');
    expect(wrapper.emitted('submit')).toHaveLength(1);
    expect(wrapper.emitted('submit')![0][0]).toEqual({ email: 'a@b.com' });
  });

  it('自定义 successText / submitText / placeholder 生效', async () => {
    const wrapper = mount(LubanLeadCapture, {
      props: { heading: 'x', submitText: '立即预约', placeholder: '请输入需求', successText: '已收到' },
    });
    expect(wrapper.find('.lb-lead-capture__submit').text()).toBe('立即预约');
    expect(wrapper.find('.lb-lead-capture__input--wide').attributes('placeholder')).toBe('请输入需求');
    await wrapper.find('input[name="phone"]').setValue('13800001111');
    await wrapper.find('form').trigger('submit.prevent');
    expect(wrapper.find('.lb-lead-capture__success').text()).toBe('已收到');
  });
});

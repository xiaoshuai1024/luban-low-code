import type { Meta, StoryObj } from '@storybook/vue3';
import {
  LubanInput,
  LubanTextArea,
  LubanSelect,
  LubanCheckbox,
  LubanRadioGroup,
  LubanSwitch,
} from '../../index';

const channelOptions = [
  { label: '官网', value: 'web' },
  { label: '广告投放', value: 'ads' },
  { label: '线下活动', value: 'offline' },
];
const budgetOptions = [
  { label: '小于 1 万', value: 1 },
  { label: '1-5 万', value: 5 },
  { label: '大于 5 万', value: 10 },
];

const meta: Meta = {
  title: 'Base/Form',
  tags: ['autodocs'],
};

export default meta;

export const LeadCapture: StoryObj = {
  render: () => ({
    components: {
      LubanInput,
      LubanTextArea,
      LubanSelect,
      LubanCheckbox,
      LubanRadioGroup,
      LubanSwitch,
    },
    data() {
      return {
        name: '',
        email: '',
        channel: null as string | number | null,
        budget: null as number | null,
        notes: '',
        agree: false,
        subscribe: true,
        channelOptions,
        budgetOptions,
      };
    },
    template: `
      <div style="max-width: 400px;">
        <LubanInput v-model="name" name="name" label="姓名" placeholder="请输入姓名" />
        <LubanInput v-model="email" name="email" label="邮箱" type="email" placeholder="name@example.com" />
        <LubanSelect v-model="channel" name="channel" label="获客渠道" placeholder="请选择" :options="channelOptions" />
        <LubanRadioGroup v-model="budget" name="budget" label="预算范围" :options="budgetOptions" />
        <LubanTextArea v-model="notes" name="notes" label="需求说明" placeholder="请简要描述" :rows="3" />
        <LubanCheckbox v-model="agree" name="agree" label="同意《隐私政策》" />
        <LubanSwitch v-model="subscribe" name="subscribe" label="接收活动通知" />
      </div>
    `,
  }),
};

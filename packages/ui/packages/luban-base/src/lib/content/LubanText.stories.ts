import type { Meta, StoryObj } from '@storybook/vue3';
import LubanText from './LubanText.vue';

const meta: Meta<typeof LubanText> = {
  title: 'Base/Content/LubanText',
  component: LubanText,
  tags: ['autodocs'],
  argTypes: {
    tag: { control: 'select', options: ['p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'] },
    variant: { control: 'select', options: ['body1', 'body2', 'caption', 'h1', 'h2', 'h3'] },
  },
};

export default meta;

export const Body: StoryObj<typeof LubanText> = {
  args: {
    content: '这是一段正文内容，可用于留资页面的说明文字。',
    variant: 'body1',
  },
};

export const Heading: StoryObj<typeof LubanText> = {
  args: {
    tag: 'h1',
    variant: 'h1',
    content: '欢迎留下联系方式',
  },
};

export const Secondary: StoryObj<typeof LubanText> = {
  args: {
    content: '次要说明文字',
    variant: 'body2',
    secondary: true,
  },
};

export const Caption: StoryObj<typeof LubanText> = {
  args: {
    content: '辅助说明或版权信息',
    variant: 'caption',
  },
};

import type { Meta, StoryObj } from '@storybook/vue3';
import LubanButton from './LubanButton.vue';

const meta: Meta<typeof LubanButton> = {
  title: 'Base/Button',
  component: LubanButton,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['contained', 'outlined', 'text'] },
    color: { control: 'select', options: ['primary', 'secondary', 'surface'] },
  },
};

export default meta;

export const Primary: StoryObj<typeof LubanButton> = {
  args: {
    variant: 'contained',
    color: 'primary',
    content: '主按钮',
  },
};

export const Secondary: StoryObj<typeof LubanButton> = {
  args: {
    variant: 'outlined',
    color: 'secondary',
    content: '次按钮',
  },
};

export const Text: StoryObj<typeof LubanButton> = {
  args: {
    variant: 'text',
    color: 'surface',
    content: '文本按钮',
  },
};

import type { Meta, StoryObj } from '@storybook/vue3';
import LubanBackToTop from './LubanBackToTop.vue';
const meta: Meta<typeof LubanBackToTop> = { title: 'Navigation/BackToTop', component: LubanBackToTop };
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = { args: { visibilityHeight: 0 } };
export const Custom: Story = { args: { right: '20px', bottom: '80px' } };

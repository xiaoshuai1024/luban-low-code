import type { Meta, StoryObj } from '@storybook/vue3';
import LubanAlert from './LubanAlert.vue';
const meta: Meta<typeof LubanAlert> = { title: 'Feedback/Alert', component: LubanAlert };
export default meta; type Story = StoryObj<typeof meta>;
export const Info: Story = { args: { type: 'info', title: 'Information', content: 'This is an info alert with a helpful message.' } };
export const Warning: Story = { args: { type: 'warning', title: 'Warning', content: 'Be careful! This action cannot be undone.' } };
export const Error: Story = { args: { type: 'error', title: 'Error', content: 'Something went wrong. Please try again.' } };
export const Success: Story = { args: { type: 'success', title: 'Success', content: 'Your changes have been saved.' } };
export const Closable: Story = { args: { type: 'info', content: 'Click X to close this alert.', closable: true } };

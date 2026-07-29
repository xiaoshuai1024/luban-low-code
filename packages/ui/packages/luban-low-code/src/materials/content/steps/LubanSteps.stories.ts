import type { Meta, StoryObj } from '@storybook/vue3';
import LubanSteps from './LubanSteps.vue';
const meta: Meta<typeof LubanSteps> = { title: 'Content/Steps', component: LubanSteps };
export default meta; type Story = StoryObj<typeof meta>;
const items = [{title:'Select Components',description:'Drag from palette to canvas'},{title:'Configure',description:'Adjust props in the right panel'},{title:'Publish',description:'Deploy with SSR rendering'}];
export const Horizontal: Story = { args: { items, direction: 'horizontal', current: 0 } };
export const Vertical: Story = { args: { items, direction: 'vertical' } };
export const Step2Active: Story = { args: { items, current: 1 } };
export const AllDone: Story = { args: { items, current: 3 } };

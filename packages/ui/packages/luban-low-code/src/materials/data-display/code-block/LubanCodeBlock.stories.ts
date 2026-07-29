import type { Meta, StoryObj } from '@storybook/vue3';
import LubanCodeBlock from './LubanCodeBlock.vue';
const meta: Meta<typeof LubanCodeBlock> = { title: 'Data Display/CodeBlock', component: LubanCodeBlock };
export default meta; type Story = StoryObj<typeof meta>;
export const JavaScript: Story = { args: { code: 'const hello = (name: string) => {\n  return `Hello, ${name}!`;\n};\n\nhello("World");', language: 'javascript' } };
export const JSON: Story = { args: { code: '{\n  "root": {\n    "type": "LubanContainer",\n    "props": {},\n    "children": []\n  }\n}', language: 'json' } };
export const NoCopy: Story = { args: { code: 'echo "hello"', language: 'bash', showCopy: false } };
export const WithHeader: Story = { args: { code: '<template>\n  <div>Hello</div>\n</template>', language: 'html', showHeader: true } };
export const Collapsed: Story = { args: { code: 'long code here', collapsed: true } };

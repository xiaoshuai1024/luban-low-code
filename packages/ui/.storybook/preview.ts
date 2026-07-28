import type { Preview } from '@storybook/vue3';
import '../apps/luban-ui/src/styles.scss';
import '../packages/luban-base/src/styles/button.scss';
import '../packages/luban-base/src/styles/layout.scss';
import '../packages/luban-base/src/styles/form.scss';
import '../packages/luban-base/src/styles/content.scss';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: 'centered',
  },
};

export default preview;


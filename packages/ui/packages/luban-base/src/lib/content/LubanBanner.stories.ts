import type { Meta, StoryObj } from '@storybook/vue3';
import LubanBanner from './LubanBanner.vue';

const meta: Meta<typeof LubanBanner> = {
  title: 'Base/Content/LubanBanner',
  component: LubanBanner,
  tags: ['autodocs'],
  argTypes: {
    objectFit: { control: 'select', options: ['cover', 'contain', 'fill', 'none'] },
  },
};

export default meta;

export const Default: StoryObj<typeof LubanBanner> = {
  args: {
    src: 'https://picsum.photos/600/200',
    alt: 'Banner',
    height: 200,
  },
};

export const WithLink: StoryObj<typeof LubanBanner> = {
  args: {
    src: 'https://picsum.photos/600/200',
    alt: 'Banner',
    height: 200,
    href: 'https://example.com',
  },
};

export const AutoHeight: StoryObj<typeof LubanBanner> = {
  args: {
    src: 'https://picsum.photos/600/200',
    alt: 'Banner',
    height: 'auto',
  },
};

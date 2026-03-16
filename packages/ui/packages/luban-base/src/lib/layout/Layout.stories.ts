import type { Meta, StoryObj } from '@storybook/vue3';
import LubanContainer from './LubanContainer.vue';
import LubanRow from './LubanRow.vue';
import LubanCol from './LubanCol.vue';
import LubanButton from '../button/LubanButton.vue';

const meta: Meta = {
  title: 'Base/Layout',
  tags: ['autodocs'],
};

export default meta;

export const Grid: StoryObj = {
  render: () => ({
    components: { LubanContainer, LubanRow, LubanCol, LubanButton },
    template: `
      <LubanContainer max-width="md" padded>
        <LubanRow :gap="12">
          <LubanCol :basis="50">
            <LubanContainer max-width="full" padded>
              <LubanButton variant="text" color="surface" content="左侧内容" />
            </LubanContainer>
          </LubanCol>
          <LubanCol :basis="50">
            <LubanContainer max-width="full" padded>
              <LubanButton variant="text" color="surface" content="右侧内容" />
            </LubanContainer>
          </LubanCol>
        </LubanRow>
      </LubanContainer>
    `,
  }),
};

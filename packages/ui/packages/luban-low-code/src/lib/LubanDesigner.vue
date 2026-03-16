<script setup lang="ts">
import { computed } from 'vue';
import RuntimeRenderer from './RuntimeRenderer.vue';
import type { PageSchema } from './schema';

const props = withDefaults(
  defineProps<{
    schema: PageSchema | null | undefined;
    showToolbar?: boolean;
    placeholder?: string;
  }>(),
  { showToolbar: true, placeholder: '从左侧拖拽组件到此处' }
);

const emit = defineEmits<{
  'update:schema': [value: PageSchema | null | undefined];
}>();

const formState = computed(() => props.schema?.formState ?? {});
</script>

<template>
  <div class="luban-designer">
    <slot v-if="showToolbar" name="toolbar" />
    <div v-if="schema?.root" class="luban-designer__canvas">
      <RuntimeRenderer
        :root="schema.root"
        :form-state="formState"
      />
    </div>
    <div v-else class="luban-designer__placeholder">
      {{ placeholder }}
    </div>
  </div>
</template>

<style scoped>
.luban-designer__placeholder {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  border: 1px dashed #ccc;
  border-radius: 4px;
}
</style>

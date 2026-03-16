<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  LubanDesigner,
  RuntimeRenderer,
  type PageSchema,
} from '@luban-ui/luban-low-code';
import { defaultDemoSchema } from './default-schema';

const schema = ref<PageSchema>(defaultDemoSchema);
const formState = computed(() => schema.value?.formState ?? {});
</script>

<template>
  <div class="app-root">
    <LubanDesigner
      v-model:schema="schema"
      :show-toolbar="true"
      placeholder="从左侧拖拽组件到此处"
    >
      <template #toolbar>
        <header class="app-header">
          <h1 data-cy="page-title">Luban UI 低代码设计器</h1>
          <p class="app-subtitle">
            设计器与基础组件集成：布局、按钮与表单均由 Schema 驱动渲染。
          </p>
        </header>
      </template>
      <RuntimeRenderer
        v-if="schema?.root"
        :root="schema.root"
        :form-state="formState"
      />
    </LubanDesigner>
  </div>
</template>

<style scoped>
.app-root {
  min-height: 100vh;
  padding: 16px;
  box-sizing: border-box;
}
.app-header {
  padding-block: 0 8px;
}
.app-subtitle {
  margin: 8px 0 0;
  color: #6b7280;
  font-size: 14px;
}
</style>

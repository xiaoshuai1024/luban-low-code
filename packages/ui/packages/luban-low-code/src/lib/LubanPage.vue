<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import RuntimeRenderer from './RuntimeRenderer.vue';
import type { PageSchema } from './schema';

const props = defineProps<{
  schema: PageSchema | null | undefined;
}>();

const formState = computed(() => props.schema?.formState ?? {});
const formErrors = ref<Record<string, string>>({});

watch(
  () => props.schema?.root?.id,
  () => {
    formErrors.value = {};
  }
);
</script>

<template>
  <div class="luban-page">
    <RuntimeRenderer
      v-if="schema?.root"
      :root="schema.root"
      :form-state="formState"
      :form-errors="formErrors"
    />
  </div>
</template>

<style scoped>
.luban-page {
  min-height: 0;
}
</style>

<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick, provide } from 'vue';
import RuntimeRenderer from './RuntimeRenderer.vue';
import type { PageSchema, NodeSchema } from './schema';
import { treeResponsiveCss } from './responsiveStyle';
import { treeAnimationCss } from './animation';
import { useAnimationObserver } from './animationObserver';
import { collectBoundCollectionIds, resolveCmsProps, type ResolvedCollectionItem } from './cmsBinding';

const props = defineProps<{
  schema: PageSchema | null | undefined;
  /**
   * 数据源拉取器（host 注入，如调 datasource query api）；缺省则不注入数据源数据。
   * 第二个可选参数是 node.datasource.params（动态查询参数），透传给后端 query。
   */
  datasourceFetcher?: (
    datasourceId: string,
    params?: Record<string, unknown>,
  ) => Promise<unknown>;
  /**
   * V2-T7 CMS 拉取器：按 collectionId 拉取 items（host 注入，如调 collection items 公开端点）。
   * 缺省则 CMS 绑定节点不渲染数据（静态 props 仍生效）。
   */
  collectionFetcher?: (collectionId: string) => Promise<ResolvedCollectionItem[]>;
}>();

const formState = computed(() => props.schema?.formState ?? {});
const formErrors = ref<Record<string, string>>({});
const datasourceCtx = ref<Record<string, unknown>>({});

const pageWrapRef = ref<HTMLElement | null>(null);

/**
 * V2-T7 CMS 解析结果：nodeId → 注入 props 映射。
 * collectionFetcher 拉取各 collection items 后，遍历有 cmsBinding 的节点，
 * 调 resolveCmsProps 计算注入 props，provide 给 RuntimeRenderer。
 */
const cmsResolvedMap = ref<Record<string, Record<string, unknown>>>({});
provide('lb-cms-resolved', computed(() => cmsResolvedMap.value));

/** 拉取所有绑定的 collection 并解析注入 props */
async function loadCmsBindings(): Promise<void> {
  const root = props.schema?.root;
  if (!root || !props.collectionFetcher) return;
  const collectionIds = collectBoundCollectionIds(root);
  if (collectionIds.length === 0) return;
  // 收集所有绑定节点（nodeId → binding）
  const bindings: { nodeId: string; binding: NonNullable<NodeSchema['cmsBinding']> }[] = [];
  function walk(node: NodeSchema): void {
    if (node.cmsBinding) bindings.push({ nodeId: node.id, binding: node.cmsBinding });
    if (node.children) for (const c of node.children) walk(c);
  }
  walk(root);
  // 按 collectionId 拉取（去重，并发）
  const itemsByCollection = new Map<string, ResolvedCollectionItem[]>();
  await Promise.all(
    collectionIds.map(async (cid) => {
      try {
        itemsByCollection.set(cid, await props.collectionFetcher!(cid));
      } catch {
        itemsByCollection.set(cid, []);
      }
    })
  );
  // 逐节点解析
  const out: Record<string, Record<string, unknown>> = {};
  for (const { nodeId, binding } of bindings) {
    const items = itemsByCollection.get(binding.collectionId) ?? [];
    out[nodeId] = resolveCmsProps(binding, items);
  }
  cmsResolvedMap.value = out;
}

/**
 * V2-T4：整树响应式 @media CSS（website SSR 运行态按视口自动应用断点样式）。
 * 仅含 tablet/mobile 覆盖；desktop 内联样式由 RuntimeRenderer nodeStyleProps 直接应用。
 * 节点用 data-lb-node="<id>" 选择器隔离，避免全局污染。无响应式覆盖时为空串。
 */
const responsiveCss = computed(() =>
  props.schema?.root ? treeResponsiveCss(props.schema.root) : ''
);

/**
 * V2-T5：整树动画 CSS（@keyframes + 选择器规则）。
 * 无动画节点不输出（零开销）。load/hover/in-view 三种触发由 CSS + IO 处理。
 */
const animationCss = computed(() =>
  props.schema?.root ? treeAnimationCss(props.schema.root) : ''
);

const extraCss = computed(() => {
  const parts: string[] = [];
  if (responsiveCss.value) parts.push(responsiveCss.value);
  if (animationCss.value) parts.push(animationCss.value);
  return parts.join('\n');
});

/**
 * V2-T5：in-view 动画观察器（进入视口触发动画）。
 * observe() 在 schema 变更 + DOM 渲染后调用。
 */
const { observe: observeAnimations } = useAnimationObserver(
  () => pageWrapRef.value,
  () => props.schema?.root ?? null
);

/** 递归收集 schema 中所有 node.datasource 绑定（含 params） */
function collectDatasources(
  node: NodeSchema | null | undefined,
  out: { id: string; varName: string; params?: Record<string, unknown> }[],
): void {
  if (!node) return;
  if (node.datasource?.id) {
    out.push({
      id: node.datasource.id,
      varName: node.datasource.varName,
      params: node.datasource.params,
    });
  }
  for (const child of node.children ?? []) collectDatasources(child, out);
}

async function loadDatasources(): Promise<void> {
  if (!props.schema?.root || !props.datasourceFetcher) {
    datasourceCtx.value = {};
    return;
  }
  const binds: { id: string; varName: string; params?: Record<string, unknown> }[] = [];
  collectDatasources(props.schema.root, binds);
  if (binds.length === 0) {
    datasourceCtx.value = {};
    return;
  }
  const entries = await Promise.all(
    binds.map(async (b) => {
      try {
        const data = await props.datasourceFetcher!(b.id, b.params);
        return [b.varName, data] as const;
      } catch (e) {
        // Surface the failure so it's not silently swallowed in production. Never
        // log config.headers (credentials) — only id + the error message.
        console.warn(
          'datasource fetch failed:',
          b.id,
          (e as Error)?.message ?? e,
        );
        return [b.varName, null] as const;
      }
    }),
  );
  datasourceCtx.value = Object.fromEntries(entries);
}

watch(
  () => props.schema?.root?.id,
  () => {
    formErrors.value = {};
    loadDatasources();
    loadCmsBindings();
    // V2-T5：schema 变更后重新观察 in-view 动画节点（等 DOM 更新）
    nextTick(() => observeAnimations());
  },
);

onMounted(() => {
  loadCmsBindings();
  nextTick(() => observeAnimations());
});
</script>

<template>
  <div ref="pageWrapRef" class="luban-page">
    <!-- V2-T4/T5 响应式 @media + 动画 @keyframes CSS：整树收集注入 -->
    <component :is="'style'" v-if="extraCss" v-html="extraCss" />
    <RuntimeRenderer
      v-if="schema?.root"
      :root="schema.root"
      :form-state="formState"
      :form-errors="formErrors"
      :ctx="datasourceCtx"
    />
  </div>
</template>

<style scoped>
.luban-page {
  min-height: 0;
}
</style>

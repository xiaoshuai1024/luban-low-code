<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  LubanDesigner,
  getComponentMeta,
  reorderRootChildren,
  getPaletteGroups,
  isPaletteType,
  type PageSchema,
} from '@luban-ui/luban-low-code';
import { LubanSidePanel, LubanForm } from '@luban-ui/luban-base';
import {
  createEmptyDesignerSchema,
  appendNodeToSchema,
  findNodeById,
  updateNodeProps,
} from './designer-test-data';

const schema = ref<PageSchema>(createEmptyDesignerSchema());
const formState = computed(() => schema.value?.formState ?? {});
const formErrors = ref<Record<string, string>>({});
const selectedNodeId = ref<string | null>(null);

const selectedNode = computed(() => {
  if (!selectedNodeId.value || !schema.value?.root) return null;
  return findNodeById(schema.value.root, selectedNodeId.value);
});

const selectedMeta = computed(() => {
  const node = selectedNode.value;
  if (!node) return null;
  return getComponentMeta(node.type);
});

function onDragStart(e: DragEvent, type: string) {
  if (!e.dataTransfer) return;
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('application/json', JSON.stringify({ type }));
}

function onAddNode(type: string, parentId?: string) {
  if (!isPaletteType(type)) return;
  if (parentId != null) {
    const parent = findNodeById(schema.value.root, parentId);
    if (!parent) return;
    const acceptTypes = getComponentMeta(parent.type)?.acceptTypes;
    if (acceptTypes != null && acceptTypes.length > 0 && !acceptTypes.includes(type))
      return;
  }
  schema.value = appendNodeToSchema(schema.value, type, parentId);
}

function onReorder(fromIndex: number, toIndex: number) {
  reorderRootChildren(schema.value!, fromIndex, toIndex);
}

function onSelect(nodeId: string | null) {
  selectedNodeId.value = nodeId;
}

function updateProp(key: string, value: unknown) {
  if (!selectedNodeId.value || !schema.value?.root) return;
  updateNodeProps(schema.value.root, selectedNodeId.value, { [key]: value });
}
</script>

<template>
  <div class="designer-test" data-cy="designer-root">
    <aside class="designer-test__palette" data-cy="designer-palette">
      <section
        v-for="group in getPaletteGroups()"
        :key="group.category"
        class="designer-test__palette-group"
      >
        <h3
          class="designer-test__palette-title"
          :data-cy="`designer-palette-group-${group.category}`"
        >
          {{ group.category }}
        </h3>
        <ul class="designer-test__palette-list">
          <li
            v-for="item in group.items"
            :key="item.type"
            class="designer-test__palette-item"
            draggable="true"
            @dragstart="onDragStart($event, item.type)"
          >
            {{ item.label }}
          </li>
        </ul>
      </section>
    </aside>
    <main class="designer-test__main" data-cy="designer-main">
      <div class="designer-test__drop-zone" data-cy="designer-drop-zone">
        <luban-designer
          v-model:schema="schema"
          :show-toolbar="false"
          :design-mode="true"
          placeholder="从左侧拖拽组件到此处"
          @select="onSelect"
          @add-node="onAddNode"
          @reorder="onReorder"
        />
      </div>
    </main>
    <luban-side-panel
      v-if="selectedNode && selectedMeta"
      v-model="selectedNodeId"
      :model-value="!!selectedNode && !!selectedMeta"
      size="medium"
    >
      <template #header>
        <h3 class="designer-test__props-title">
          {{ selectedMeta.label }}配置
        </h3>
      </template>
      <template #body>
        <luban-form size="medium">
          <div class="designer-test__props-form">
            <template
              v-for="(item, key) in selectedMeta.propSchema"
              :key="String(key)"
            >
              <label
                v-if="item.type === 'string'"
                class="designer-test__prop-row"
              >
                <span class="designer-test__prop-label">
                  {{ item.label ?? key }}
                </span>
                <input
                  :value="(selectedNode!.props ?? {})[key]"
                  type="text"
                  class="designer-test__prop-input"
                  @input="
                    updateProp(key, ($event.target as HTMLInputElement).value)
                  "
                />
              </label>
              <label
                v-else-if="item.type === 'number'"
                class="designer-test__prop-row"
              >
                <span class="designer-test__prop-label">
                  {{ item.label ?? key }}
                </span>
                <input
                  :value="(selectedNode!.props ?? {})[key]"
                  type="number"
                  class="designer-test__prop-input"
                  @input="
                    updateProp(
                      key,
                      Number(($event.target as HTMLInputElement).value)
                    )
                  "
                />
              </label>
              <label
                v-else-if="item.type === 'boolean'"
                class="designer-test__prop-row"
              >
                <span class="designer-test__prop-label">
                  {{ item.label ?? key }}
                </span>
                <input
                  type="checkbox"
                  :checked="(selectedNode!.props ?? {})[key]"
                  @change="
                    updateProp(
                      key,
                      ($event.target as HTMLInputElement).checked
                    )
                  "
                />
              </label>
              <label
                v-else-if="item.type === 'select'"
                class="designer-test__prop-row"
              >
                <span class="designer-test__prop-label">
                  {{ item.label ?? key }}
                </span>
                <select
                  :value="(selectedNode!.props ?? {})[key]"
                  class="designer-test__prop-input"
                  @change="
                    updateProp(key, ($event.target as HTMLSelectElement).value)
                  "
                >
                  <option
                    v-for="opt in item.options ?? []"
                    :key="String(opt.value)"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </option>
                </select>
              </label>
            </template>
          </div>
        </luban-form>
      </template>
    </luban-side-panel>
  </div>
</template>

<style scoped>
.designer-test {
  display: flex;
  min-height: 100vh;
  padding: 16px;
  box-sizing: border-box;
  gap: 16px;
}
.designer-test__palette {
  flex-shrink: 0;
  width: 180px;
  padding: 12px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.12);
}
.designer-test__palette-group {
  margin-bottom: 16px;
}
.designer-test__palette-group:last-child {
  margin-bottom: 0;
}
.designer-test__palette-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
  text-transform: none;
}
.designer-test__palette-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.designer-test__palette-item {
  padding: 8px 12px;
  margin-bottom: 4px;
  font-size: 13px;
  color: #1f2933;
  background: #f3f4f6;
  border-radius: 6px;
  cursor: grab;
  user-select: none;
}
.designer-test__palette-item:active {
  cursor: grabbing;
}
.designer-test__palette-item:hover {
  background: #e5e7eb;
}
.designer-test__main {
  flex: 1;
  min-width: 0;
}
.designer-test__toolbar {
  padding-block: 0 4px;
}
.designer-test__toolbar-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}
.designer-test__toolbar-desc {
  margin: 4px 0 0;
  font-size: 13px;
  color: #6b7280;
}
.designer-test__drop-zone {
  min-height: 280px;
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}
.designer-test__props-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}
.designer-test__props-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.designer-test__prop-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}
.designer-test__prop-label {
  color: #6b7280;
}
.designer-test__prop-input {
  padding: 6px 8px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  font-size: 13px;
}
@media (max-width: 900px) {
  .designer-test__props {
    display: none;
  }
}
@media (max-width: 600px) {
  .designer-test {
    flex-direction: column;
  }
  .designer-test__palette {
    width: 100%;
  }
}
</style>

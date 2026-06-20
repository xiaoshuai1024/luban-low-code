<script setup lang="ts">
/**
 * LubanTabs — 标签页物料组件（navigation/tabs）。
 *
 * 轻量自研实现（Material Design 风格），不依赖 element-plus。
 * activeKey 受控；type 控制视觉变体：'' 默认下划线 / 'card' 卡片 / 'border-card' 带边框卡片。
 */
interface TabItem {
  label: string;
  key: string;
}

type TabsType = '' | 'card' | 'border-card';

const props = withDefaults(
  defineProps<{
    tabs?: TabItem[];
    activeKey?: string;
    type?: TabsType;
  }>(),
  {
    tabs: () => [],
    activeKey: '',
    type: '',
  }
);

const emit = defineEmits<{
  /** 切换标签页（参数：tab.key） */
  change: [key: string];
}>();

function onChange(key: string): void {
  emit('change', key);
}

function isActive(key: string): boolean {
  return props.activeKey === key;
}

function typeClass(): string {
  return props.type ? `lb-tabs--${props.type}` : 'lb-tabs--line';
}
</script>

<template>
  <div class="lb-tabs" :class="typeClass()">
    <div class="lb-tabs__nav" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="lb-tabs__tab"
        :class="{ 'lb-tabs__tab--active': isActive(tab.key) }"
        role="tab"
        :aria-selected="isActive(tab.key) ? 'true' : 'false'"
        @click="onChange(tab.key)"
      >
        {{ tab.label }}
      </button>
    </div>
    <div class="lb-tabs__panel">
      <slot :active-key="activeKey" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.lb-tabs {
  font-size: 14px;
  color: rgba(0, 0, 0, 0.87);

  &__nav {
    display: flex;
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  }

  &__tab {
    appearance: none;
    background: transparent;
    border: none;
    padding: 12px 16px;
    cursor: pointer;
    color: rgba(0, 0, 0, 0.6);
    font-size: inherit;
    transition: color 0.15s ease;

    &:hover {
      color: #1976d2;
    }

    &--active {
      color: #1976d2;
      font-weight: 500;
    }
  }

  &--line &__tab--active {
    border-bottom: 2px solid #1976d2;
    margin-bottom: -1px;
  }

  &--card &__tab {
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-bottom: none;
    border-radius: 4px 4px 0 0;
    margin-right: 4px;
    background: #fafafa;

    &--active {
      background: #fff;
      color: #1976d2;
    }
  }

  &--border-card {
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 4px;
    overflow: hidden;

    .lb-tabs__nav {
      background: #fafafa;
      border-bottom: 1px solid rgba(0, 0, 0, 0.12);
    }

    .lb-tabs__tab--active {
      background: #fff;
    }
  }

  &__panel {
    padding: 16px;
  }
}
</style>

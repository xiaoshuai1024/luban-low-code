<script setup lang="ts">
/**
 * LubanCodeBlock — 代码片段展示（highlight.js + 一键复制）。
 */
import { ref, computed } from 'vue';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import sql from 'highlight.js/lib/languages/sql';
import yaml from 'highlight.js/lib/languages/yaml';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('python', python);
hljs.registerLanguage('java', java);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('yaml', yaml);

const props = withDefaults(
  defineProps<{
    code?: string;
    language?: string;
    showCopy?: boolean;
    showHeader?: boolean;
    collapsed?: boolean;
    maxHeight?: string;
  }>(),
  {
    code: '',
    language: 'plain',
    showCopy: true,
    showHeader: false,
    collapsed: false,
    maxHeight: '',
  },
);

const collapsedState = ref(props.collapsed);
const copied = ref(false);

const highlighted = computed(() => {
  if (!props.code) return '';
  const lang = props.language || 'plain';
  if (lang !== 'plain' && hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(props.code, { language: lang, ignoreIllegals: true }).value;
    } catch {
      /* fallthrough */
    }
  }
  return props.code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
});

function onCopy() {
  navigator.clipboard.writeText(props.code).then(() => {
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  });
}

function onToggle() {
  collapsedState.value = !collapsedState.value;
}
</script>

<template>
  <div
    class="lb-code-block"
    :class="{
      'lb-code-block--collapsed': collapsedState,
      'lb-code-block--scrollable': !!maxHeight,
    }"
    :style="{ maxHeight: maxHeight || undefined }"
  >
    <div v-if="showHeader || showCopy" class="lb-code-block__header">
      <span v-if="showHeader" class="lb-code-block__lang">{{ language }}</span>
      <button v-if="showCopy" class="lb-code-block__copy" @click="onCopy">
        {{ copied ? '✓ 已复制' : '📋 复制' }}
      </button>
      <button
        v-if="collapsed !== undefined"
        class="lb-code-block__toggle"
        @click="onToggle"
      >
        {{ collapsedState ? '展开' : '折叠' }}
      </button>
    </div>
    <pre class="lb-code-block__pre"><code class="hljs" v-html="highlighted" /></pre>
  </div>
</template>

<style lang="scss" scoped>
.lb-code-block {
  background: #1e1e1e;
  border-radius: 8px;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.6;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.05);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  &__lang {
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
    text-transform: uppercase;
  }
  &__copy,
  &__toggle {
    appearance: none;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.7);
    padding: 2px 10px;
    font-size: 12px;
    cursor: pointer;
    &:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  }
  &__pre {
    margin: 0;
    padding: 16px;
    overflow-x: auto;
    color: #d4d4d4;
    font-family: 'Fira Code', 'Consolas', monospace;
  }

  // 语法高亮 token 着色（GitHub Dark 调色板，与 #1e1e1e 背景协调）。
  // 本组件为深色容器，不能复用 LubanMarkdown 引入的全局 github.css 浅色
  // 主题（hljs class 全局同名会互相覆盖），故在 scoped 层自带深色 token。
  :deep(code.hljs) {
    background: transparent; // 覆盖全局 .hljs 白底（如消费方页面引入了浅色主题）
    color: inherit;
  }
  :deep(.hljs-comment),
  :deep(.hljs-quote) { color: #8b949e; }
  :deep(.hljs-keyword),
  :deep(.hljs-selector-tag),
  :deep(.hljs-deletion) { color: #ff7b72; }
  :deep(.hljs-string),
  :deep(.hljs-regexp),
  :deep(.hljs-addition) { color: #a5d6ff; }
  :deep(.hljs-title),
  :deep(.hljs-section) { color: #d2a8ff; }
  :deep(.hljs-number),
  :deep(.hljs-literal),
  :deep(.hljs-type) { color: #79c0ff; }
  :deep(.hljs-name),
  :deep(.hljs-tag) { color: #7ee787; }
  :deep(.hljs-attr),
  :deep(.hljs-attribute),
  :deep(.hljs-variable),
  :deep(.hljs-template-variable) { color: #ffa657; }

  &--collapsed &__pre {
    display: none;
  }

  // maxHeight 限高时可纵向滚动，超出的代码不丢失（spec: 超高代码可滚动）
  &--scrollable {
    overflow-y: auto;
  }
}
</style>

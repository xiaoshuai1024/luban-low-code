<script setup lang="ts">
/**
 * LubanMarkdown — Markdown 渲染器（markdown-it + highlight.js）。
 *
 * 支持 CommonMark + 代码高亮；在低代码平台中作为 content 类物料使用。
 * theme 控制代码块高亮主题样式（GitHub / VuePress / Simple）。
 */
import { computed } from 'vue';
import MarkdownIt from 'markdown-it';
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
    content?: string;
    theme?: 'github' | 'vuepress' | 'simple';
    highlight?: boolean;
    breaks?: boolean;
    linkify?: boolean;
  }>(),
  {
    content: '',
    theme: 'github',
    highlight: true,
    breaks: true,
    linkify: true,
  },
);

const md = computed(() => {
  const instance = new MarkdownIt({
    html: false,
    breaks: props.breaks,
    linkify: props.linkify,
    highlight: props.highlight
      ? (str: string, lang: string) => {
          if (lang && hljs.getLanguage(lang)) {
            try {
              return (
                '<pre class="hljs"><code>' +
                hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
                '</code></pre>'
              );
            } catch {
              /* fallthrough to escaped */
            }
          }
          return (
            '<pre class="hljs"><code>' +
            md.value.utils.escapeHtml(str) +
            '</code></pre>'
          );
        }
      : undefined,
  });
  return instance;
});

const html = computed(() => md.value.render(props.content));
</script>

<template>
  <div class="luban-markdown" :class="`luban-markdown--${theme}`" v-html="html" />
</template>

<style lang="scss" scoped>
.luban-markdown {
  color: rgba(0, 0, 0, 0.87);
  font-size: 15px;
  line-height: 1.75;

  :deep(h1) { font-size: 2em; margin: 0.67em 0; font-weight: 700; }
  :deep(h2) { font-size: 1.5em; margin: 0.83em 0; font-weight: 600; }
  :deep(h3) { font-size: 1.25em; margin: 1em 0 0.5em; font-weight: 600; }
  :deep(h4) { font-size: 1.1em; margin: 1em 0 0.4em; }
  :deep(p) { margin: 0.5em 0; }
  :deep(ul, ol) { padding-left: 1.5em; margin: 0.5em 0; }
  :deep(li) { margin: 0.25em 0; }
  :deep(a) { color: #1976d2; }
  :deep(blockquote) {
    border-left: 4px solid #1976d2;
    padding: 0.5em 1em;
    margin: 1em 0;
    background: rgba(25, 118, 210, 0.05);
  }
  :deep(code) {
    background: rgba(0, 0, 0, 0.06);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.9em;
    font-family: 'Fira Code', 'Consolas', monospace;
  }
  :deep(pre) {
    background: #f5f5f5;
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 1em 0;
    code {
      background: none;
      padding: 0;
      font-size: 13px;
      line-height: 1.6;
    }
  }
  :deep(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 1em 0;
    th, td {
      border: 1px solid rgba(0,0,0,0.12);
      padding: 8px 12px;
      text-align: left;
    }
    th { background: #fafafa; font-weight: 600; }
  }
  :deep(hr) { border: none; border-top: 1px solid rgba(0,0,0,0.12); margin: 2em 0; }

  &--vuepress {
    :deep(h1, h2, h3) { color: #2c3e50; }
  }
  &--simple {
    font-size: 16px;
    :deep(pre) { background: #1e1e1e; color: #d4d4d4; }
  }
}
</style>

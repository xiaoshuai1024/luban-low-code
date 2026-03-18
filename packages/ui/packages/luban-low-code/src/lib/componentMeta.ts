import type { Component } from 'vue';
import { getComponent } from './registry';

/**
 * Schema for a single prop (for property panel and validation).
 */
export interface PropSchemaItem {
  type: 'string' | 'number' | 'boolean' | 'select' | 'json' | 'options';
  default?: unknown;
  required?: boolean;
  /** For select: { label: string; value: string | number }[] */
  options?: { label: string; value: string | number }[];
  label?: string;
}

export type PropSchema = Record<string, PropSchemaItem>;

/**
 * Component metadata for design-time: property panel, default props, and drop rules.
 */
export interface ComponentMeta {
  type: string;
  category: 'layout' | 'form' | 'content' | 'button';
  label: string;
  component: Component;
  propSchema: PropSchema;
  defaultProps: Record<string, unknown>;
  events: string[];
  /** If true, this component can accept child nodes (drop zone). */
  isContainer?: boolean;
  /** Allowed child types when isContainer; empty = any registered. */
  acceptTypes?: string[];
}

const metaByType: Record<string, ComponentMeta> = {};

function registerMeta(meta: ComponentMeta): void {
  metaByType[meta.type] = meta;
}

function buildDefaultMeta(): void {
  const comp = (t: string) => getComponent(t)!;
  registerMeta({
    type: 'LubanButton',
    category: 'button',
    label: '按钮',
    component: comp('LubanButton'),
    propSchema: {
      content: { type: 'string', label: '文案', default: '按钮' },
      variant: {
        type: 'select',
        label: '变体',
        default: 'contained',
        options: [
          { label: '实心', value: 'contained' },
          { label: '描边', value: 'outlined' },
          { label: '文本', value: 'text' },
        ],
      },
      color: {
        type: 'select',
        label: '颜色',
        default: 'primary',
        options: [
          { label: '主色', value: 'primary' },
          { label: '次色', value: 'secondary' },
          { label: '表面', value: 'surface' },
        ],
      },
      disabled: { type: 'boolean', label: '禁用', default: false },
      block: { type: 'boolean', label: '块级', default: false },
    },
    defaultProps: { content: '按钮', variant: 'contained', color: 'primary' },
    events: ['click'],
  });

  registerMeta({
    type: 'LubanContainer',
    category: 'layout',
    label: '容器',
    component: comp('LubanContainer'),
    isContainer: true,
    propSchema: {
      maxWidth: {
        type: 'select',
        label: '最大宽度',
        default: 'lg',
        options: [
          { label: 'sm', value: 'sm' },
          { label: 'md', value: 'md' },
          { label: 'lg', value: 'lg' },
          { label: 'xl', value: 'xl' },
          { label: 'full', value: 'full' },
        ],
      },
      padded: { type: 'boolean', label: '内边距', default: true },
    },
    defaultProps: { maxWidth: 'md', padded: true },
    events: [],
  });

  registerMeta({
    type: 'LubanRow',
    category: 'layout',
    label: '行',
    component: comp('LubanRow'),
    isContainer: true,
    propSchema: {
      gap: { type: 'number', label: '间距', default: 16 },
      align: {
        type: 'select',
        label: '垂直对齐',
        default: 'stretch',
        options: [
          { label: 'start', value: 'start' },
          { label: 'center', value: 'center' },
          { label: 'end', value: 'end' },
          { label: 'stretch', value: 'stretch' },
        ],
      },
      justify: {
        type: 'select',
        label: '水平对齐',
        default: 'start',
        options: [
          { label: 'start', value: 'start' },
          { label: 'center', value: 'center' },
          { label: 'end', value: 'end' },
          { label: 'between', value: 'between' },
          { label: 'around', value: 'around' },
        ],
      },
    },
    defaultProps: { gap: 16 },
    events: [],
  });

  registerMeta({
    type: 'LubanCol',
    category: 'layout',
    label: '列',
    component: comp('LubanCol'),
    isContainer: true,
    propSchema: {
      basis: { type: 'number', label: '基础宽度(%)', default: 50 },
      grow: { type: 'number', label: 'flex-grow', default: 1 },
    },
    defaultProps: { basis: 50 },
    events: [],
  });

  const FORM_CONTROL_TYPES = [
    'LubanInput',
    'LubanTextArea',
    'LubanSelect',
    'LubanCheckbox',
    'LubanRadioGroup',
    'LubanSwitch',
  ];
  registerMeta({
    type: 'LubanForm',
    category: 'form',
    label: '表单',
    component: comp('LubanForm'),
    isContainer: true,
    acceptTypes: FORM_CONTROL_TYPES,
    propSchema: {},
    defaultProps: {},
    events: ['submit'],
  });

  registerMeta({
    type: 'LubanInput',
    category: 'form',
    label: '输入框',
    component: comp('LubanInput'),
    propSchema: {
      name: { type: 'string', label: '字段名' },
      label: { type: 'string', label: '标签', default: '输入框' },
      placeholder: { type: 'string', label: '占位' },
      type: {
        type: 'select',
        label: '类型',
        default: 'text',
        options: [
          { label: '文本', value: 'text' },
          { label: '邮箱', value: 'email' },
          { label: '电话', value: 'tel' },
          { label: '数字', value: 'number' },
          { label: '密码', value: 'password' },
        ],
      },
      required: { type: 'boolean', label: '必填', default: false },
      disabled: { type: 'boolean', label: '禁用', default: false },
    },
    defaultProps: { label: '输入框', placeholder: '请输入' },
    events: ['update:modelValue', 'blur', 'focus'],
  });

  registerMeta({
    type: 'LubanTextArea',
    category: 'form',
    label: '多行文本',
    component: comp('LubanTextArea'),
    propSchema: {
      name: { type: 'string', label: '字段名' },
      label: { type: 'string', label: '标签', default: '多行文本' },
      placeholder: { type: 'string', label: '占位' },
      rows: { type: 'number', label: '行数', default: 3 },
      required: { type: 'boolean', label: '必填', default: false },
      disabled: { type: 'boolean', label: '禁用', default: false },
    },
    defaultProps: { label: '多行文本', rows: 3 },
    events: ['update:modelValue', 'blur', 'focus'],
  });

  registerMeta({
    type: 'LubanSelect',
    category: 'form',
    label: '选择',
    component: comp('LubanSelect'),
    propSchema: {
      name: { type: 'string', label: '字段名' },
      label: { type: 'string', label: '标签', default: '选择' },
      placeholder: { type: 'string', label: '占位', default: '请选择' },
      options: { type: 'options', label: '选项', default: [] },
      required: { type: 'boolean', label: '必填', default: false },
      disabled: { type: 'boolean', label: '禁用', default: false },
    },
    defaultProps: { label: '选择', placeholder: '请选择', options: [] },
    events: ['update:modelValue', 'blur', 'focus'],
  });

  registerMeta({
    type: 'LubanCheckbox',
    category: 'form',
    label: '复选框',
    component: comp('LubanCheckbox'),
    propSchema: {
      name: { type: 'string', label: '字段名' },
      label: { type: 'string', label: '标签', default: '复选框' },
      required: { type: 'boolean', label: '必填', default: false },
      disabled: { type: 'boolean', label: '禁用', default: false },
    },
    defaultProps: { label: '复选框' },
    events: ['update:modelValue'],
  });

  registerMeta({
    type: 'LubanRadioGroup',
    category: 'form',
    label: '单选',
    component: comp('LubanRadioGroup'),
    propSchema: {
      name: { type: 'string', label: '字段名' },
      label: { type: 'string', label: '标签', default: '单选' },
      options: { type: 'options', label: '选项', default: [] },
      required: { type: 'boolean', label: '必填', default: false },
      disabled: { type: 'boolean', label: '禁用', default: false },
    },
    defaultProps: { label: '单选', options: [] },
    events: ['update:modelValue'],
  });

  registerMeta({
    type: 'LubanSwitch',
    category: 'form',
    label: '开关',
    component: comp('LubanSwitch'),
    propSchema: {
      name: { type: 'string', label: '字段名' },
      label: { type: 'string', label: '标签', default: '开关' },
      disabled: { type: 'boolean', label: '禁用', default: false },
    },
    defaultProps: { label: '开关' },
    events: ['update:modelValue'],
  });

  registerMeta({
    type: 'LubanBanner',
    category: 'content',
    label: '横幅',
    component: comp('LubanBanner'),
    propSchema: {
      content: { type: 'string', label: '内容' },
    },
    defaultProps: {},
    events: [],
  });

  registerMeta({
    type: 'LubanText',
    category: 'content',
    label: '文本',
    component: comp('LubanText'),
    propSchema: {
      content: { type: 'string', label: '内容' },
    },
    defaultProps: {},
    events: [],
  });
}

let built = false;
function ensureMeta(): void {
  if (!built) {
    buildDefaultMeta();
    built = true;
  }
}

export function getComponentMeta(type: string): ComponentMeta | undefined {
  ensureMeta();
  return metaByType[type];
}

export function getAllComponentMeta(): ComponentMeta[] {
  ensureMeta();
  return Object.values(metaByType);
}

export function registerComponentMeta(meta: ComponentMeta): void {
  built = true;
  registerMeta(meta);
}

import type { NodeSchema, PageSchema } from '@luban-ui/luban-low-code';

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `node-${Date.now()}-${idCounter}`;
}

/** 根据组件类型生成新节点的默认 props，并返回需写入 formState 的 name（若有） */
export function defaultPropsForType(
  type: string,
  id: string
): { props: Record<string, unknown>; formStateKey?: string; formStateValue?: unknown } {
  const name = `field_${id}`;
  const base = { name };
  switch (type) {
    case 'LubanText':
      return { props: { tag: 'p', content: '文本内容' } };
    case 'LubanBanner':
      return {
        props: {
          src: 'https://via.placeholder.com/800x200?text=Banner',
          alt: '横幅',
        },
      };
    case 'LubanButton':
      return { props: { content: '按钮', variant: 'contained', color: 'primary' } };
    case 'LubanInput':
      return {
        props: { ...base, label: '输入框', placeholder: '请输入' },
        formStateKey: name,
        formStateValue: '',
      };
    case 'LubanTextArea':
      return {
        props: { ...base, label: '多行文本', placeholder: '请输入', rows: 3 },
        formStateKey: name,
        formStateValue: '',
      };
    case 'LubanSelect':
      return {
        props: {
          ...base,
          label: '选择',
          placeholder: '请选择',
          options: [
            { label: '选项 A', value: 'a' },
            { label: '选项 B', value: 'b' },
          ],
        },
        formStateKey: name,
        formStateValue: null,
      };
    case 'LubanCheckbox':
      return {
        props: { ...base, label: '复选框' },
        formStateKey: name,
        formStateValue: false,
      };
    case 'LubanRadioGroup':
      return {
        props: {
          ...base,
          label: '单选',
          options: [
            { label: '选项 1', value: 1 },
            { label: '选项 2', value: 2 },
          ],
        },
        formStateKey: name,
        formStateValue: null,
      };
    case 'LubanSwitch':
      return {
        props: { ...base, label: '开关' },
        formStateKey: name,
        formStateValue: false,
      };
    case 'LubanForm':
      return { props: {} };
    case 'LubanContainer':
      return { props: { maxWidth: 'full', padded: true } };
    case 'LubanRow':
      return { props: { gap: 12 } };
    case 'LubanCol':
      return { props: { basis: 50 } };
    default:
      return { props: {} };
  }
}

/** 创建空的设计器 schema（仅根容器，无子节点） */
export function createEmptyDesignerSchema(): PageSchema {
  return {
    formState: {},
    root: {
      id: 'root',
      type: 'LubanContainer',
      props: { maxWidth: 'full', padded: true },
      children: [],
    },
  };
}

/**
 * 根据类型创建新节点并追加到 schema。
 * @param parentId 未传则追加到 root.children；传入则追加到该 id 对应节点的 children（用于拖入表单等容器）
 */
export function appendNodeToSchema(
  schema: PageSchema,
  type: string,
  parentId?: string
): PageSchema {
  const id = nextId();
  const { props, formStateKey, formStateValue } = defaultPropsForType(type, id);
  const newNode: NodeSchema = {
    id,
    type,
    props,
    children: [],
  };
  const formState = { ...(schema.formState ?? {}) };
  if (formStateKey != null) {
    formState[formStateKey] = formStateValue;
  }
  if (parentId == null) {
    const root = {
      ...schema.root,
      children: [...(schema.root.children ?? []), newNode],
    };
    return { ...schema, formState, root };
  }
  const parent = findNodeById(schema.root, parentId);
  if (!parent) return schema;
  parent.children = [...(parent.children ?? []), newNode];
  return { ...schema, formState };
}

/** Find node by id in tree. */
export function findNodeById(root: NodeSchema, id: string): NodeSchema | null {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

/** Update props of node by id (mutates schema). */
export function updateNodeProps(
  root: NodeSchema,
  nodeId: string,
  props: Record<string, unknown>
): boolean {
  if (root.id === nodeId) {
    root.props = { ...(root.props ?? {}), ...props };
    return true;
  }
  for (const child of root.children ?? []) {
    if (updateNodeProps(child, nodeId, props)) return true;
  }
  return false;
}

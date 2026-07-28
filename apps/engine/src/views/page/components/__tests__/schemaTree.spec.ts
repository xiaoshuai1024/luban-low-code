/**
 * schemaTree.spec.ts — schemaTree 纯逻辑单元测试。
 *
 * 覆盖 findNode / findParent / removeNode / moveChild / locateInParent
 * 的边界：空树、深嵌套、id 不存在、root 级移动、容器内移动、越界。
 *
 * 运行：engine 仓根目录 `pnpm test`（vitest run）。
 * 前置：engine node_modules 已 install（见 [待确认] 节）。
 */
import { describe, it, expect } from 'vitest'
import {
  findNode,
  findParent,
  removeNode,
  moveChild,
  locateInParent,
} from '../schemaTree'
import type { NodeSchema } from '@/types/schema'

/** 构造一棵多层级 fixture 树：
 *   root
 *   ├── a (LubanContainer)
 *   │   ├── a1 (LubanButton)
 *   │   └── a2 (LubanInput)
 *   ├── b (LubanButton)
 *   └── c (LubanRow)
 *       └── c1 (LubanContainer)
 *           └── c1a (LubanText)   ← 深嵌套
 */
function buildTree(): NodeSchema {
  return {
    id: 'root',
    type: 'LubanContainer',
    props: {},
    children: [
      {
        id: 'a',
        type: 'LubanContainer',
        props: {},
        children: [
          { id: 'a1', type: 'LubanButton', props: {} },
          { id: 'a2', type: 'LubanInput', props: {} },
        ],
      },
      { id: 'b', type: 'LubanButton', props: {} },
      {
        id: 'c',
        type: 'LubanRow',
        props: {},
        children: [
          {
            id: 'c1',
            type: 'LubanContainer',
            props: {},
            children: [{ id: 'c1a', type: 'LubanText', props: {} }],
          },
        ],
      },
    ],
  }
}

describe('findNode', () => {
  it('命中 root 自身', () => {
    const root = buildTree()
    expect(findNode(root, 'root')).toBe(root)
  })

  it('命中直接子节点', () => {
    const root = buildTree()
    const b = findNode(root, 'b')
    expect(b?.id).toBe('b')
    expect(b?.type).toBe('LubanButton')
  })

  it('命中深层嵌套节点', () => {
    const root = buildTree()
    const deep = findNode(root, 'c1a')
    expect(deep?.id).toBe('c1a')
    expect(deep?.type).toBe('LubanText')
  })

  it('id 不存在返回 null', () => {
    const root = buildTree()
    expect(findNode(root, 'nope')).toBeNull()
  })

  it('无 children 的叶子节点查找不命中其他 id', () => {
    const leaf: NodeSchema = { id: 'leaf', type: 'LubanButton', props: {} }
    expect(findNode(leaf, 'leaf')).toBe(leaf)
    expect(findNode(leaf, 'other')).toBeNull()
  })
})

describe('findParent', () => {
  it('root 的 parent 为 null', () => {
    const root = buildTree()
    expect(findParent(root, 'root')).toBeNull()
  })

  it('root 级子节点的 parent 是 root', () => {
    const root = buildTree()
    expect(findParent(root, 'b')).toBe(root)
    expect(findParent(root, 'a')).toBe(root)
  })

  it('深层节点的 parent 是其直接父容器', () => {
    const root = buildTree()
    const parent = findParent(root, 'a1')
    expect(parent?.id).toBe('a')

    const deepParent = findParent(root, 'c1a')
    expect(deepParent?.id).toBe('c1')
  })

  it('id 不存在返回 null', () => {
    const root = buildTree()
    expect(findParent(root, 'missing')).toBeNull()
  })
})

describe('removeNode', () => {
  it('删除 root 级节点', () => {
    const root = buildTree()
    expect(removeNode(root, 'b')).toBe(true)
    expect(findNode(root, 'b')).toBeNull()
    expect(root.children?.length).toBe(2)
  })

  it('删除深层嵌套节点', () => {
    const root = buildTree()
    expect(removeNode(root, 'c1a')).toBe(true)
    expect(findNode(root, 'c1a')).toBeNull()
    const c1 = findNode(root, 'c1')
    expect(c1?.children?.length).toBe(0)
  })

  it('删除容器节点会连带移除其子树引用', () => {
    const root = buildTree()
    expect(removeNode(root, 'a')).toBe(true)
    expect(findNode(root, 'a')).toBeNull()
    expect(findNode(root, 'a1')).toBeNull() // 整棵子树不再可达
    expect(findNode(root, 'a2')).toBeNull()
  })

  it('删除 root 自身失败（root 不可删）', () => {
    const root = buildTree()
    expect(removeNode(root, 'root')).toBe(false)
  })

  it('删除不存在的 id 返回 false', () => {
    const root = buildTree()
    expect(removeNode(root, 'ghost')).toBe(false)
    expect(root.children?.length).toBe(3)
  })
})

describe('moveChild', () => {
  it('root 级：parent=null 时操作 root.children', () => {
    const root = buildTree()
    // [a, b, c] → 把 a(0) 移到 (1)：[b, a, c]
    expect(moveChild(null, root, 0, 1)).toBe(true)
    expect(root.children?.map((c) => c.id)).toEqual(['b', 'a', 'c'])
  })

  it('root 级：移到末尾', () => {
    const root = buildTree()
    expect(moveChild(null, root, 0, 2)).toBe(true)
    expect(root.children?.map((c) => c.id)).toEqual(['b', 'c', 'a'])
  })

  it('容器内移动：操作 parent.children', () => {
    const root = buildTree()
    const a = findNode(root, 'a')!
    // [a1, a2] → 把 a2(1) 移到 (0)：[a2, a1]
    expect(moveChild(a, root, 1, 0)).toBe(true)
    expect(a.children?.map((c) => c.id)).toEqual(['a2', 'a1'])
  })

  it('fromIdx === toIdx 返回 false（无操作）', () => {
    const root = buildTree()
    expect(moveChild(null, root, 1, 1)).toBe(false)
    expect(root.children?.map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })

  it('fromIdx 越界返回 false', () => {
    const root = buildTree()
    expect(moveChild(null, root, 5, 0)).toBe(false)
    expect(moveChild(null, root, -1, 0)).toBe(false)
  })

  it('toIdx 越界返回 false', () => {
    const root = buildTree()
    expect(moveChild(null, root, 0, 99)).toBe(false)
    expect(moveChild(null, root, 0, -1)).toBe(false)
  })

  it('parent 无 children 返回 false', () => {
    const root = buildTree()
    const leaf: NodeSchema = { id: 'leaf', type: 'LubanButton', props: {} }
    expect(moveChild(leaf, root, 0, 1)).toBe(false)
  })

  it('root 为 null/undefined 安全返回 false', () => {
    expect(moveChild(null, null as unknown as NodeSchema, 0, 1)).toBe(false)
  })
})

describe('locateInParent', () => {
  it('root 级节点：parent=null + 正确 index', () => {
    const root = buildTree()
    const loc = locateInParent(root, 'b')
    expect(loc?.parent).toBeNull()
    expect(loc?.index).toBe(1)
  })

  it('容器内节点：parent=容器 + 正确 index', () => {
    const root = buildTree()
    const loc = locateInParent(root, 'a2')
    expect(loc?.parent?.id).toBe('a')
    expect(loc?.index).toBe(1)
  })

  it('root 自身：返回 parent=null, index=-1（无父级语义）', () => {
    const root = buildTree()
    const loc = locateInParent(root, 'root')
    expect(loc?.parent).toBeNull()
    expect(loc?.index).toBe(-1)
  })

  it('不存在的 id 返回 null', () => {
    const root = buildTree()
    expect(locateInParent(root, 'unknown')).toBeNull()
  })
})

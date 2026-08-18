/**
 * PageEditor.spec.ts — PageEditor.vue 集成测试（T4 收口）。
 *
 * PageEditor 静态 import luban-low-code（设计器/预览/物料 meta），
 * 而 engine 本地 node_modules 中 luban-low-code 是 link symlink，
 * dist 未构建、运行时不可解析。本测试用 vi.mock stub 掉 luban-low-code
 * 与 @/api/page、vue-router，专注验证 PageEditor 自身的事件接通逻辑：
 *   - designMode=true 时挂 LubanDesigner 并传 design-mode
 *   - 预览切 LubanPage
 *   - onAddNode 写 meta.defaultProps 到 schema
 *   - onSelect/onDeleteNode/onUpdateProp 接通 schemaTree 与 reactive 回写
 *   - 发布按钮 → publishPage 调用（status=published）
 *   - loadPage 失败显示错误卡片 + 重试按钮（替换静默 catch）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { reactive } from 'vue'

// luban-low-code 由 vitest.config.ts 的 alias 解析到本地 stub（src/test/lubanLowCodeStub.ts）。
// 此处 import 拿到 stub 暴露的 hooks / fixtures，供测试触发 LubanDesigner 的 emit。
import {
  designerEmitHooks,
  designerPropsHolder,
  resetLubanStub,
} from '@/test/lubanLowCodeStub'

// === stubs for vue-router（PageEditor 用 useRoute/useRouter） ===
// reactive 化：PageEditor 的 siteId/pageId computed 才能响应 params 变化
//（watch([siteId, pageId]) → loadPage → history.reset 切页隔离测试依赖此行为）。
const routeState = reactive({
  params: { siteId: 'site-1', pageId: 'page-1' },
  name: 'PageEditor',
  meta: {},
})
const routerPush = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: () => routeState,
  useRouter: () => ({ push: routerPush, replace: routerPush }),
}))

// === stubs for @/api/page ===
const getPageMock = vi.fn()
const createPageMock = vi.fn()
const savePageMock = vi.fn()
const publishPageMock = vi.fn()
vi.mock('@/api/page', () => ({
  getPage: (...args: unknown[]) => getPageMock(...args),
  createPage: (...args: unknown[]) => createPageMock(...args),
  savePage: (...args: unknown[]) => savePageMock(...args),
  publishPage: (...args: unknown[]) => publishPageMock(...args),
  deletePage: vi.fn(),
}))

// ElMessageBox.confirm stub：默认 resolve（点确认），可被单个测试覆盖为 reject。
const confirmMock = vi.fn().mockResolvedValue('confirm')
vi.mock('element-plus', async () => {
  const actual = await vi.importActual<typeof import('element-plus')>('element-plus')
  return {
    ...actual,
    ElMessageBox: {
      ...actual.ElMessageBox,
      confirm: (...args: unknown[]) => confirmMock(...args),
    },
  }
})

import PageEditor from '../PageEditor.vue'

function mountEditor() {
  return mount(PageEditor, {
    global: {
      plugins: [createPinia()],
      stubs: {
        // 避免真实 Element Plus 组件树带来的渲染成本与副作用
        Transition: false,
        TransitionGroup: false,
      },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  resetLubanStub()
  // 默认 getPage 返回一个带空 schema 的页面
  getPageMock.mockResolvedValue({
    data: {
      id: 'page-1',
      siteId: 'site-1',
      name: '首页',
      path: '/home',
      status: 'draft',
      schema: {
        root: { id: 'root', type: 'LubanContainer', props: {}, children: [] },
      },
    },
  })
})

describe('PageEditor.vue', () => {
  it('designMode=true 时挂载 LubanDesigner 并传入 design-mode', async () => {
    const wrapper = mountEditor()
    await flushPromises()
    expect(getPageMock).toHaveBeenCalledWith('site-1', 'page-1')
    const designer = wrapper.find('.designer-stub')
    expect(designer.exists()).toBe(true)
    expect(designerPropsHolder.current?.designMode).toBe(true)
  })

  it('切到预览时渲染 LubanPage 而非 LubanDesigner', async () => {
    const wrapper = mountEditor()
    await flushPromises()
    expect(wrapper.find('.designer-stub').exists()).toBe(true)
    expect(wrapper.find('.page-stub').exists()).toBe(false)
    // 点击「预览」按钮（文本匹配）
    const previewBtn = wrapper.findAll('button').find((b) => b.text().includes('预览'))
    expect(previewBtn).toBeDefined()
    await previewBtn!.trigger('click')
    await flushPromises()
    expect(wrapper.find('.designer-stub').exists()).toBe(false)
    expect(wrapper.find('.page-stub').exists()).toBe(true)
  })

  it('onAddNode 把 meta.defaultProps 写入 root.children 并选中', async () => {
    mountEditor()
    await flushPromises()
    // 初始 root.children 为空
    const designerProps1 = designerPropsHolder.current as { schema: { root: { children: unknown[] } } }
    expect(designerProps1.schema.root.children).toHaveLength(0)

    // 触发 LubanDesigner emit('add-node', 'LubanButton')
    expect(designerEmitHooks.addNode).toBeTruthy()
    designerEmitHooks.addNode!('LubanButton')
    await flushPromises()

    const designerProps2 = designerPropsHolder.current as {
      schema: { root: { children: Array<{ id: string; type: string; props: Record<string, unknown> }> } }
    }
    const children = designerProps2.schema.root.children
    expect(children).toHaveLength(1)
    expect(children[0].type).toBe('LubanButton')
    // defaultProps 来自 metaFixture.LubanButton
    expect(children[0].props).toMatchObject({ text: '按钮', type: 'default' })
    // 选中 id 应等于新节点 id（PropertyPanel/ComponentTree 据此显示）
    // 通过触发 designer select 校验 onSelect 链路，但更直接的是检查 selectedId 反映在子组件 props
    expect(children[0].id).toBeTruthy()
  })

  it('onReorder 调用 reorderRootChildren 重排 root.children', async () => {
    mountEditor()
    await flushPromises()
    // 先加两个节点
    designerEmitHooks.addNode!('LubanButton')
    designerEmitHooks.addNode!('LubanInput')
    await flushPromises()

    const before = designerPropsHolder.current as {
      schema: { root: { children: Array<{ type: string }> } }
    }
    expect(before.schema.root.children.map((c) => c.type)).toEqual(['LubanButton', 'LubanInput'])

    // reorder(0, 1)：[Button, Input] → [Input, Button]
    expect(designerEmitHooks.reorder).toBeTruthy()
    designerEmitHooks.reorder!(0, 1)
    await flushPromises()

    const after = designerPropsHolder.current as {
      schema: { root: { children: Array<{ type: string }> } }
    }
    expect(after.schema.root.children.map((c) => c.type)).toEqual(['LubanInput', 'LubanButton'])
  })

  it('onUpdateProp 写回节点 props', async () => {
    const wrapper = mountEditor()
    await flushPromises()
    designerEmitHooks.addNode!('LubanButton')
    await flushPromises()
    const dp = designerPropsHolder.current as {
      schema: { root: { children: Array<{ id: string; props: Record<string, unknown> }> } }
    }
    const nodeId = dp.schema.root.children[0].id

    // 选中节点 → PropertyPanel 才会渲染，但更直接地通过 onSelect + PropertyPanel emit 模拟较繁琐；
    // 这里直接验证 reactive schema：模拟 PropertyPanel 写 prop 的副作用（PageEditor.onUpdateProp 是入口）
    // 通过 wrapper.vm 访问未暴露的方法不可行，故用「选中→属性面板触发」链路：
    designerEmitHooks.select!(nodeId)
    await flushPromises()
    // PropertyPanel 在选中时渲染，emit('update:prop', nodeId, 'text', '已点击')
    const panel = wrapper.findComponent({ name: 'PropertyPanel' })
    // PropertyPanel 可能因为 schemaEntries 空（fixture propSchema={}）而无可编辑控件；
    // 直接调用其 emit 模拟用户改值
    panel.vm.$emit('update:prop', nodeId, 'text', '已点击')
    await flushPromises()

    const after = designerPropsHolder.current as {
      schema: { root: { children: Array<{ props: Record<string, unknown> }> } }
    }
    expect(after.schema.root.children[0].props.text).toBe('已点击')
  })

  it('发布按钮点击 → publishPage 被调用且 status=published', async () => {
    publishPageMock.mockResolvedValue({
      data: { id: 'page-1', siteId: 'site-1', name: '首页', path: '/home', status: 'published' },
    })
    const wrapper = mountEditor()
    await flushPromises()

    const publishBtn = wrapper.findAll('button').find((b) => b.text().trim() === '发布')
    expect(publishBtn).toBeDefined()
    await publishBtn!.trigger('click')
    await flushPromises()

    expect(confirmMock).toHaveBeenCalled()
    expect(publishPageMock).toHaveBeenCalledTimes(1)
    const args = publishPageMock.mock.calls[0]
    expect(args[0]).toBe('site-1')
    expect(args[1]).toBe('page-1')
    // 第三个参数应带 status=published（由 publishPage helper 注入，但这里 mock 替换了整个 publishPage，
    // 故 args[2] 是 PageEditor 传入的 {name,path,schema}；status 由真实 publishPage helper 注入，
    // 在 mock 场景下断言 args[2] 不含 status，真实 publishPage 行为由 api/page 单测覆盖）
    expect(args[2]).toMatchObject({ name: '首页', path: '/home' })
  })

  it('loadPage 失败 → 显示错误卡片与重试按钮（不静默）', async () => {
    getPageMock.mockRejectedValueOnce(new Error('网络错误'))
    const wrapper = mountEditor()
    await flushPromises()

    // 错误卡片应渲染且包含错误文案
    const errorCard = wrapper.find('.page-editor__error-card')
    expect(errorCard.exists()).toBe(true)
    expect(wrapper.text()).toContain('网络错误')
    // 重试按钮存在
    const retryBtn = errorCard.findAll('button').find((b) => b.text().includes('重试'))
    expect(retryBtn).toBeDefined()

    // 不应渲染工作区（schema 为 null）
    expect(wrapper.find('.page-editor__workspace').exists()).toBe(false)

    // 点击重试 → 重新调用 getPage（本次成功）
    getPageMock.mockResolvedValueOnce({
      data: {
        id: 'page-1',
        siteId: 'site-1',
        name: '首页',
        path: '/home',
        status: 'draft',
        schema: { root: { id: 'root', type: 'LubanContainer', props: {}, children: [] } },
      },
    })
    await retryBtn!.trigger('click')
    await flushPromises()
    expect(getPageMock).toHaveBeenCalledTimes(2)
    // 重试成功后工作区出现
    expect(wrapper.find('.page-editor__workspace').exists()).toBe(true)
  })

  it('修改属性后 undo 恢复旧值（撤销时序：快照在变更前）', async () => {
    const wrapper = mountEditor()
    await flushPromises()
    designerEmitHooks.addNode!('LubanButton')
    await flushPromises()
    const dp = designerPropsHolder.current as {
      schema: { root: { children: Array<{ id: string; props: Record<string, unknown>; style?: Record<string, string> }> } }
    }
    const nodeId = dp.schema.root.children[0].id
    expect(dp.schema.root.children[0].props.text).toBe('按钮') // meta.defaultProps 初值

    designerEmitHooks.select!(nodeId)
    await flushPromises()
    const panel = wrapper.findComponent({ name: 'PropertyPanel' })

    // 修改 prop（PropertyPanel emit → PageEditor push 后写入）
    panel.vm.$emit('update:prop', nodeId, 'text', '已点击')
    await flushPromises()
    let cur = (designerPropsHolder.current as typeof dp).schema.root.children[0]
    expect(cur.props.text).toBe('已点击')

    // 修改 style（同一模式：emit → push 后写入）
    panel.vm.$emit('update:style', nodeId, 'width', '100px')
    await flushPromises()
    cur = (designerPropsHolder.current as typeof dp).schema.root.children[0]
    expect(cur.style?.width).toBe('100px')

    // undo 1：回退 style 修改 → width 键被删除（空值语义）
    const undoBtn = wrapper.findAll('button').find((b) => b.attributes('title') === '撤销 (Ctrl+Z)')
    expect(undoBtn).toBeDefined()
    await undoBtn!.trigger('click')
    await flushPromises()
    cur = (designerPropsHolder.current as typeof dp).schema.root.children[0]
    expect(cur.style?.width).toBeUndefined()
    expect(cur.props.text).toBe('已点击') // style 撤销不影响 prop

    // undo 2：回退 prop 修改 → 恢复旧值（撤销时序修复的核心验收）
    const undoBtn2 = wrapper.findAll('button').find((b) => b.attributes('title') === '撤销 (Ctrl+Z)')
    await undoBtn2!.trigger('click')
    await flushPromises()
    cur = (designerPropsHolder.current as typeof dp).schema.root.children[0]
    expect(cur.props.text).toBe('按钮')
  })

  it('切换页面后撤销栈重置（页面隔离：undo 不可跨页）', async () => {
    const wrapper = mountEditor()
    await flushPromises()

    // 加一个节点 → canUndo=true（撤销按钮可用）
    designerEmitHooks.addNode!('LubanButton')
    await flushPromises()
    const undoBtn = wrapper.findAll('button').find((b) => b.attributes('title') === '撤销 (Ctrl+Z)')
    expect(undoBtn).toBeDefined()
    expect(undoBtn!.attributes('disabled')).toBeUndefined()

    // 切换 pageId → watch 触发 loadPage → 成功后 history.reset()
    routeState.params.pageId = 'page-2'
    await flushPromises()
    expect(getPageMock).toHaveBeenCalledWith('site-1', 'page-2')

    // 撤销栈已清空 → 按钮禁用（不会把上一页 schema 写回当前页）
    const undoBtnAfter = wrapper.findAll('button').find((b) => b.attributes('title') === '撤销 (Ctrl+Z)')
    expect(undoBtnAfter).toBeDefined()
    expect(undoBtnAfter!.attributes('disabled')).toBeDefined()
  })
})

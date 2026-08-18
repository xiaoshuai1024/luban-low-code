/**
 * DatasourceManageDialog.spec.ts — 数据源管理弹窗保存校验单测（close-tech-debt-1 1.4/1.6）。
 *
 * 验收：config 文本为非法 JSON（handleConfigInput 以 string 原样暂存）时，
 * 保存被拦截 —— ElMessage.error 提示且不发起 create/update 请求；
 * 合法 JSON 对象正常透传保存。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

// mock @/api/datasource：列表返回空，create/update 为 spy
const getDatasourcesMock = vi.fn()
const createDatasourceMock = vi.fn()
const updateDatasourceMock = vi.fn()
vi.mock('@/api/datasource', () => ({
  getDatasources: (...a: unknown[]) => getDatasourcesMock(...a),
  createDatasource: (...a: unknown[]) => createDatasourceMock(...a),
  updateDatasource: (...a: unknown[]) => updateDatasourceMock(...a),
  deleteDatasource: vi.fn(),
  testDatasource: vi.fn(),
}))

// ElMessage stub（真实组件树保留）：拦截 error/warning/success 便于断言
vi.mock('element-plus', async () => {
  const actual = await vi.importActual<typeof import('element-plus')>('element-plus')
  return {
    ...actual,
    ElMessage: {
      error: vi.fn(),
      warning: vi.fn(),
      success: vi.fn(),
    },
  }
})

import DatasourceManageDialog from '../DatasourceManageDialog.vue'
import { ElMessage } from 'element-plus'

/** 进入「新建数据源」编辑态：打开弹窗 → 点新建按钮 */
async function openCreateForm() {
  const wrapper = mount(DatasourceManageDialog, {
    props: { modelValue: true, siteId: 'site-1' },
  })
  await flushPromises() // loadList
  const createBtn = wrapper.findAll('button').find((b) => b.text().includes('新建数据源'))
  expect(createBtn).toBeDefined()
  await createBtn!.trigger('click')
  await flushPromises()
  return wrapper
}

async function fillAndSave(wrapper: ReturnType<typeof mount>, name: string, configText: string) {
  const nameInput = wrapper.find('input[placeholder="数据源名称"]')
  expect(nameInput.exists()).toBe(true)
  await nameInput.setValue(name)
  const textarea = wrapper.find('textarea')
  expect(textarea.exists()).toBe(true)
  await textarea.setValue(configText)
  const saveBtn = wrapper.findAll('button').find((b) => b.text().includes('创建'))
  expect(saveBtn).toBeDefined()
  await saveBtn!.trigger('click')
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  getDatasourcesMock.mockResolvedValue({ data: [] })
  createDatasourceMock.mockResolvedValue({ data: { id: 'ds-new' } })
  updateDatasourceMock.mockResolvedValue({ data: { id: 'ds-1' } })
})

describe('DatasourceManageDialog 保存前 config JSON 校验（close-tech-debt-1 1.4）', () => {
  it('非法 JSON 文本 → ElMessage.error 且不发保存请求', async () => {
    const wrapper = await openCreateForm()
    await fillAndSave(wrapper, '测试源', '{"rows": [1,2')

    expect(createDatasourceMock).not.toHaveBeenCalled()
    expect(updateDatasourceMock).not.toHaveBeenCalled()
    expect(ElMessage.error).toHaveBeenCalledWith(
      expect.stringContaining('JSON')
    )
  })

  it('合法 JSON 但非对象（数字/数组/字符串）→ 同样拦截', async () => {
    const wrapper = await openCreateForm()
    // JSON.parse('123') → number，以非对象形态暂存
    await fillAndSave(wrapper, '测试源', '123')

    expect(createDatasourceMock).not.toHaveBeenCalled()
    expect(ElMessage.error).toHaveBeenCalled()
  })

  it('合法 JSON 对象 → 正常发起创建请求并透传解析后的对象', async () => {
    const wrapper = await openCreateForm()
    await fillAndSave(wrapper, '测试源', '{"rows":[1,2]}')

    expect(createDatasourceMock).toHaveBeenCalledTimes(1)
    expect(createDatasourceMock.mock.calls[0][0]).toMatchObject({
      siteId: 'site-1',
      name: '测试源',
      type: 'static',
      config: { rows: [1, 2] },
    })
    expect(ElMessage.error).not.toHaveBeenCalled()
  })

  it('名称为空 → 提示且不发请求（既有校验保留）', async () => {
    const wrapper = await openCreateForm()
    await fillAndSave(wrapper, '', '{"rows":[]}')

    expect(createDatasourceMock).not.toHaveBeenCalled()
    expect(ElMessage.warning).toHaveBeenCalledWith('请填写数据源名称')
  })
})

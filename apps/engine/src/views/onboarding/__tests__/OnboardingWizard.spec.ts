/**
 * OnboardingWizard.spec.ts — 开通向导三步状态机单测（signup-billing-onboarding T-eng-3）。
 *
 * 覆盖（§4.2.2）：
 *  - Step1 套餐加载（三档 + Free 默认选中 + Starter 试用角标）/ 失败重试 / 空兜底；
 *  - 「立即开通」→ createOrder → ElResult 支付成功 → 1.5s 自动进 Step2；INVALID_PLAN 重刷套餐；
 *  - Step2 建站：slug 建议值 + 预检 available → createSite → Step3；
 *    409 SLUG_TAKEN 内联；429 QUOTA_EXCEEDED → ElAlert；
 *  - Step3 模板 → createPage（首页 /）→ 跳设计器；失败停留可重试；
 *  - 已完成步回退（不撤订单）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import axios from 'axios'

const { routerReplace, getPlansMock, createOrderMock, createSiteMock, checkSlugMock, createPageMock } =
  vi.hoisted(() => ({
    routerReplace: vi.fn(),
    getPlansMock: vi.fn(),
    createOrderMock: vi.fn(),
    createSiteMock: vi.fn(),
    checkSlugMock: vi.fn(),
    createPageMock: vi.fn(),
  }))

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: routerReplace, push: vi.fn() }),
}))

vi.mock('@/api/billing', () => ({
  getPlans: (...args: unknown[]) => getPlansMock(...args),
  createOrder: (...args: unknown[]) => createOrderMock(...args),
}))

vi.mock('@/api/site', () => ({
  createSite: (...args: unknown[]) => createSiteMock(...args),
  checkSlug: (...args: unknown[]) => checkSlugMock(...args),
}))

vi.mock('@/api/page', () => ({
  createPage: (...args: unknown[]) => createPageMock(...args),
}))

import OnboardingWizard from '../OnboardingWizard.vue'

const PLANS = [
  { planCode: 'free', name: 'Free', priceMonthly: 0, quotaLeads: 100, quotaPages: 3, quotaVisits: 0, trialDays: 0 },
  { planCode: 'starter', name: 'Starter', priceMonthly: 0, quotaLeads: 1000, quotaPages: 10, quotaVisits: 0, trialDays: 14 },
  { planCode: 'growth', name: 'Growth', priceMonthly: 0, quotaLeads: 10000, quotaPages: 50, quotaVisits: 0, trialDays: 0 },
]

function apiError(status: number, body: { code?: string; message: string }) {
  return new axios.AxiosError(body.message, 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    data: body,
  } as never)
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function mountWizard(plans = PLANS) {
  getPlansMock.mockResolvedValue({ data: plans })
  const wrapper = mount(OnboardingWizard)
  await flushPromises()
  return wrapper
}

/** 走完 Step1（下单成功），停在 Step2 */
async function mountAtStep2() {
  createOrderMock.mockResolvedValue({ data: {} })
  const wrapper = await mountWizard()
  const openBtn = wrapper.findAll('button').find((b) => b.text().includes('立即开通'))!
  await openBtn.trigger('click')
  await flushPromises()
  await sleep(1600)
  await flushPromises()
  return wrapper
}

/** Step2 填表并通过 slug 预检（available） */
async function fillSiteForm(wrapper: Awaited<ReturnType<typeof mountAtStep2>>) {
  checkSlugMock.mockResolvedValue({ data: { available: true, slug: 'acme-site' } })
  const nameInput = wrapper.find('[data-testid="site-name"]')
  await nameInput.setValue('Acme Site')
  // slug 建议值自动生成 → 防抖 500ms 预检
  await sleep(600)
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('OnboardingWizard Step1 选套餐', () => {
  it('加载三档套餐：Free 默认选中 + Starter 试用角标 + 配额摘要', async () => {
    const wrapper = await mountWizard()
    const cards = wrapper.findAll('.plan-picker__card:not(.is-skeleton)')
    expect(cards).toHaveLength(3)
    expect(wrapper.find('.plan-picker__card.is-selected').text()).toContain('Free')
    expect(wrapper.text()).toContain('14 天试用')
    expect(wrapper.text()).toContain('站点内页面数：3')
    expect(wrapper.text()).toContain('月留资数：1000')
  })

  it('点选 Growth 切换选中，立即开通按所选 planCode 下单', async () => {
    createOrderMock.mockResolvedValue({ data: {} })
    const wrapper = await mountWizard()
    const growth = wrapper.findAll('.plan-picker__card:not(.is-skeleton)').find((c) => c.text().includes('Growth'))!
    await growth.trigger('click')
    const btn = wrapper.findAll('button').find((b) => b.text().includes('立即开通'))!
    await btn.trigger('click')
    await flushPromises()
    expect(createOrderMock).toHaveBeenCalledWith('growth')
  })

  it('套餐加载失败 → ElResult error + 重试重新拉取', async () => {
    getPlansMock.mockRejectedValueOnce(apiError(500, { message: 'backend down' }))
    const wrapper = mount(OnboardingWizard)
    await flushPromises()
    expect(wrapper.text()).toContain('backend down')
    const retry = wrapper.findAll('button').find((b) => b.text().includes('重试'))!
    expect(retry).toBeDefined()
    getPlansMock.mockResolvedValue({ data: PLANS })
    await retry.trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.plan-picker__card:not(.is-skeleton)')).toHaveLength(3)
  })

  it('套餐为空数组 → 异常兜底「获取套餐失败」', async () => {
    getPlansMock.mockResolvedValue({ data: [] })
    const wrapper = mount(OnboardingWizard)
    await flushPromises()
    expect(wrapper.text()).toContain('获取套餐失败，请稍后重试')
  })

  it('立即开通成功 → 支付成功反馈 → 1.5s 自动进 Step2', async () => {
    createOrderMock.mockResolvedValue({
      data: { order: { orderNo: 'NO1', status: 'paid' }, subscription: {} },
    })
    const wrapper = await mountWizard()
    const btn = wrapper.findAll('button').find((b) => b.text().includes('立即开通'))!
    await btn.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('支付成功 · 套餐已开通')
    expect(wrapper.find('[data-testid="site-name"]').exists()).toBe(false)

    await sleep(1600)
    await flushPromises()
    expect(wrapper.find('[data-testid="site-name"]').exists()).toBe(true)
  })

  it('INVALID_PLAN → 重新拉取套餐', async () => {
    createOrderMock.mockRejectedValue(apiError(400, { code: 'INVALID_PLAN', message: 'invalid' }))
    const wrapper = await mountWizard()
    expect(getPlansMock).toHaveBeenCalledTimes(1)
    const btn = wrapper.findAll('button').find((b) => b.text().includes('立即开通'))!
    await btn.trigger('click')
    await flushPromises()
    expect(getPlansMock).toHaveBeenCalledTimes(2)
  })
})

describe('OnboardingWizard Step2 创建站点', () => {
  it('站点名 → slug 建议值 + 预检可用 → 创建成功进 Step3', async () => {
    createSiteMock.mockResolvedValue({ data: { id: 'site-1', name: 'Acme Site', slug: 'acme-site' } })
    const wrapper = await mountAtStep2()

    await fillSiteForm(wrapper)
    expect(wrapper.find('[data-testid="site-slug"]').element.value || wrapper.text()).toBeTruthy()
    expect(wrapper.text()).toContain('该地址可用')

    const btn = wrapper.findAll('button').find((b) => b.text().includes('创建站点'))!
    await btn.trigger('click')
    await flushPromises()

    expect(createSiteMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Acme Site', slug: 'acme-site', status: 'active' }),
    )
    // 进入 Step3 模板网格
    expect(wrapper.find('.template-select').exists()).toBe(true)
  })

  it('纯中文名 → 随机 site- 建议值（无拼音库回退）', async () => {
    const wrapper = await mountAtStep2()
    checkSlugMock.mockResolvedValue({ data: { available: true } })
    await wrapper.find('[data-testid="site-name"]').setValue('我的商店')
    await sleep(600)
    await flushPromises()
    const slug = (wrapper.find('[data-testid="site-slug"]').element as HTMLInputElement).value
    expect(slug).toMatch(/^site-[a-z0-9]{1,8}$/)
  })

  it('slug 已被占用（预检 taken）→ 校验不通过不提交', async () => {
    createSiteMock.mockResolvedValue({ data: { id: 'site-1' } })
    const wrapper = await mountAtStep2()
    checkSlugMock.mockResolvedValue({ data: { available: false } })
    await wrapper.find('[data-testid="site-name"]').setValue('Acme Site')
    await sleep(600)
    await flushPromises()
    const btn = wrapper.findAll('button').find((b) => b.text().includes('创建站点'))!
    await btn.trigger('click')
    await sleep(150) // ElFormItem 错误展示 100ms 防抖
    await flushPromises()
    expect(createSiteMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('该站点地址已被占用')
  })

  it('createSite 409 SLUG_TAKEN → slug 内联错误', async () => {
    createSiteMock.mockRejectedValue(apiError(409, { code: 'SLUG_TAKEN', message: 'slug taken' }))
    const wrapper = await mountAtStep2()
    await fillSiteForm(wrapper)
    const btn = wrapper.findAll('button').find((b) => b.text().includes('创建站点'))!
    await btn.trigger('click')
    await sleep(150) // ElFormItem 错误展示 100ms 防抖
    await flushPromises()
    expect(wrapper.text()).toContain('该站点地址已被占用，请更换')
  })

  it('createSite 429 QUOTA_EXCEEDED → ElAlert「套餐页面数已达上限」', async () => {
    createSiteMock.mockRejectedValue(
      apiError(429, { code: 'QUOTA_EXCEEDED', message: 'quota', details: { metric: 'pages' } }),
    )
    const wrapper = await mountAtStep2()
    await fillSiteForm(wrapper)
    const btn = wrapper.findAll('button').find((b) => b.text().includes('创建站点'))!
    await btn.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('套餐页面数已达上限，请升级套餐')
    // 停留 Step2
    expect(wrapper.find('[data-testid="site-name"]').exists()).toBe(true)
  })
})

describe('OnboardingWizard Step3 模板建首页', () => {
  async function mountAtStep3() {
    createSiteMock.mockResolvedValue({ data: { id: 'site-9' } })
    const wrapper = await mountAtStep2()
    await fillSiteForm(wrapper)
    const btn = wrapper.findAll('button').find((b) => b.text().includes('创建站点'))!
    await btn.trigger('click')
    await flushPromises()
    return wrapper
  }

  it('选模板 → 开始编辑 → createPage(首页,/) → 跳设计器', async () => {
    createPageMock.mockResolvedValue({ data: { id: 'page-9' } })
    const wrapper = await mountAtStep3()

    // 默认选中空白页；切换到 SaaS 模板
    const saas = wrapper.findAll('.template-select__card').find((c) => c.text().includes('SaaS 产品落地页'))!
    await saas.trigger('click')
    expect(wrapper.findAll('.template-select__card.is-selected').length).toBe(1)

    const btn = wrapper.findAll('button').find((b) => b.text().includes('开始编辑'))!
    await btn.trigger('click')
    await flushPromises()

    expect(createPageMock).toHaveBeenCalledWith(
      'site-9',
      expect.objectContaining({ name: '首页', path: '/', schema: expect.anything() }),
    )
    expect(routerReplace).toHaveBeenCalledWith('/designer/sites/site-9/pages/page-9')
  })

  it('createPage 失败 → 停留 Step3 可重试', async () => {
    createPageMock.mockRejectedValueOnce(apiError(500, { message: 'boom' }))
    const wrapper = await mountAtStep3()
    const btn = wrapper.findAll('button').find((b) => b.text().includes('开始编辑'))!
    await btn.trigger('click')
    await flushPromises()
    expect(wrapper.find('.template-select').exists()).toBe(true)

    createPageMock.mockResolvedValue({ data: { id: 'page-10' } })
    await btn.trigger('click')
    await flushPromises()
    expect(routerReplace).toHaveBeenCalledWith('/designer/sites/site-9/pages/page-10')
  })

  it('已完成步可回退：Step3 → Step2，且回退不重复下单', async () => {
    const wrapper = await mountAtStep3()
    expect(createOrderMock).toHaveBeenCalledTimes(1)
    const back = wrapper.findAll('button').find((b) => b.text().includes('上一步'))!
    await back.trigger('click')
    expect(wrapper.find('[data-testid="site-name"]').exists()).toBe(true)
    expect(createOrderMock).toHaveBeenCalledTimes(1)
  })
})

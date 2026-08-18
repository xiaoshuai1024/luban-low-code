/**
 * OnboardingComponents.spec.ts — PlanPicker / SiteForm / TemplateSelect 组件单测（signup-billing-onboarding T-eng-3）。
 *
 * 三个向导子组件的状态机与错误分支（vitest 覆盖率门禁配套）：
 *  - PlanPicker：loading 骨架 / 三卡渲染 / 试用角标 / 点选 emit；
 *  - SiteForm：名称→slug 建议值 / 手动改后不再覆盖 / 防抖 500ms 预检三态（含过期响应丢弃）/ validate 分支 / setSlugError；
 *  - TemplateSelect：分组渲染 / 点选 emit / 选中态。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'

const { checkSlugMock } = vi.hoisted(() => ({ checkSlugMock: vi.fn() }))

vi.mock('@/api/site', () => ({
  checkSlug: (...args: unknown[]) => checkSlugMock(...args),
}))

import PlanPicker from '../PlanPicker.vue'
import SiteForm from '../SiteForm.vue'
import TemplateSelect from '../TemplateSelect.vue'

const PLANS = [
  { planCode: 'free', name: 'Free', priceMonthly: 0, quotaLeads: 100, quotaPages: 3, quotaVisits: 0, trialDays: 0 },
  { planCode: 'starter', name: 'Starter', priceMonthly: 0, quotaLeads: 1000, quotaPages: 10, quotaVisits: 0, trialDays: 14 },
  { planCode: 'growth', name: 'Growth', priceMonthly: 0, quotaLeads: 10000, quotaPages: 0, quotaVisits: 0, trialDays: 0 },
]

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PlanPicker', () => {
  it('loading → 渲染三张骨架卡', () => {
    const wrapper = mount(PlanPicker, {
      props: { plans: [], modelValue: '', loading: true },
    })
    expect(wrapper.findAll('.plan-picker__card.is-skeleton')).toHaveLength(3)
  })

  it('渲染三档卡：配额摘要（0=不限）+ Starter 试用角标 + 选中态', () => {
    const wrapper = mount(PlanPicker, {
      props: { plans: PLANS, modelValue: 'free' },
    })
    const cards = wrapper.findAll('.plan-picker__card:not(.is-skeleton)')
    expect(cards).toHaveLength(3)
    expect(cards[0].classes()).toContain('is-selected')
    expect(wrapper.text()).toContain('14 天试用')
    expect(wrapper.text()).toContain('不限') // growth quotaPages=0
    expect(wrapper.text()).toContain('已选择')
  })

  it('点卡 → emit update:modelValue', async () => {
    const wrapper = mount(PlanPicker, { props: { plans: PLANS, modelValue: 'free' } })
    const growth = wrapper.findAll('.plan-picker__card:not(.is-skeleton)')[2]
    await growth.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['growth']])
  })
})

describe('SiteForm', () => {
  /**
   * v-model 宿主：SiteForm 的建议值/防抖逻辑依赖 props 回写（真实父组件行为），
   * 裸 mount 不回写 props 会导致 watcher 不触发。
   */
  const SiteFormHost = defineComponent({
    name: 'SiteFormHost',
    setup() {
      const value = ref({ name: '', slug: '' })
      return () =>
        h(SiteForm, {
          modelValue: value.value,
          'onUpdate:modelValue': (v: { name: string; slug: string }) => {
            value.value = v
          },
        })
    },
  })

  function mountSiteForm() {
    const wrapper = mount(SiteFormHost)
    const form = wrapper.findComponent(SiteForm)
    return { wrapper, form }
  }

  function slugValue(wrapper: ReturnType<typeof mountSiteForm>['wrapper']): string {
    return (wrapper.find('[data-testid="site-slug"]').element as HTMLInputElement).value
  }

  it('站点名（拉丁）→ slug 建议值自动生成', async () => {
    const { wrapper } = mountSiteForm()
    await wrapper.find('[data-testid="site-name"]').setValue('Acme Site')
    await flushPromises()
    expect(slugValue(wrapper)).toBe('acme-site')
  })

  it('手动改过 slug 后，改名不再覆盖', async () => {
    const { wrapper } = mountSiteForm()
    await wrapper.find('[data-testid="site-slug"]').setValue('my-custom-slug')
    await flushPromises()
    await wrapper.find('[data-testid="site-name"]').setValue('Another Name')
    await flushPromises()
    expect(slugValue(wrapper)).toBe('my-custom-slug')
  })

  it('slug 防抖 500ms 预检：checking → available（绿色可用）', async () => {
    checkSlugMock.mockResolvedValue({ data: { available: true, slug: 'acme-site' } })
    const { wrapper } = mountSiteForm()
    await wrapper.find('[data-testid="site-slug"]').setValue('acme-site')
    await flushPromises()
    // 防抖窗口内 checking
    expect(wrapper.text()).toContain('正在检查地址是否可用')
    expect(checkSlugMock).not.toHaveBeenCalled()
    await sleep(600)
    await flushPromises()
    expect(checkSlugMock).toHaveBeenCalledWith('acme-site')
    expect(wrapper.text()).toContain('该地址可用')
  })

  it('预检竞态：旧请求后返回不得覆盖新 slug 结果', async () => {
    let resolveOld!: (v: { data: { available: boolean } }) => void
    checkSlugMock
      .mockImplementationOnce(() => new Promise((r) => { resolveOld = r }))
      .mockResolvedValueOnce({ data: { available: true } })
    const { wrapper } = mountSiteForm()
    await wrapper.find('[data-testid="site-slug"]').setValue('old-slug')
    await sleep(600)
    await flushPromises()
    expect(checkSlugMock).toHaveBeenCalledWith('old-slug')

    // 改为新 slug → 第二次预检 available
    await wrapper.find('[data-testid="site-slug"]').setValue('new-slug')
    await sleep(600)
    await flushPromises()
    expect(checkSlugMock).toHaveBeenCalledWith('new-slug')
    expect(wrapper.text()).toContain('该地址可用')

    // 旧请求（taken）迟达 → 过期结果被丢弃，不覆盖新结果
    resolveOld({ data: { available: false } })
    await flushPromises()
    expect(wrapper.text()).toContain('该地址可用')
    expect(wrapper.text()).not.toContain('该地址已被占用')
  })

  it('预检 taken → 红色「已被占用」；validate 拦截提交', async () => {
    checkSlugMock.mockResolvedValue({ data: { available: false } })
    const { wrapper, form } = mountSiteForm()
    await wrapper.find('[data-testid="site-slug"]').setValue('acme-site')
    await sleep(600)
    await flushPromises()
    expect(wrapper.text()).toContain('该地址已被占用')

    const vm = form.vm as unknown as { validate(): boolean }
    await wrapper.find('[data-testid="site-name"]').setValue('Acme')
    await flushPromises()
    expect(vm.validate()).toBe(false)
  })

  it('预检网络失败（非 409）→ 不阻塞提交（服务端兜底）', async () => {
    checkSlugMock.mockRejectedValue(new Error('network down'))
    const { wrapper, form } = mountSiteForm()
    await wrapper.find('[data-testid="site-name"]').setValue('Acme Site')
    await sleep(600)
    await flushPromises()
    const vm = form.vm as unknown as { validate(): boolean }
    expect(vm.validate()).toBe(true)
  })

  it('validate：空名/超长名/非法 slug → 对应错误', async () => {
    const { wrapper, form } = mountSiteForm()
    const vm = form.vm as unknown as { validate(): boolean }
    expect(vm.validate()).toBe(false)
    await sleep(150) // ElFormItem 100ms 防抖
    expect(wrapper.text()).toContain('请输入站点名称')

    await wrapper.find('[data-testid="site-name"]').setValue('x'.repeat(33))
    await flushPromises()
    expect(vm.validate()).toBe(false)
    await sleep(150)
    expect(wrapper.text()).toContain('不能超过 32 个字符')

    await wrapper.find('[data-testid="site-name"]').setValue('Acme')
    await wrapper.find('[data-testid="site-slug"]').setValue('BAD')
    await flushPromises()
    expect(vm.validate()).toBe(false)
    await sleep(150)
    expect(wrapper.text()).toContain('站点地址需为 3-48 位小写字母、数字或短横线')
  })

  it('setSlugError（向导 409 回写）→ taken 内联错误', async () => {
    const { wrapper, form } = mountSiteForm()
    const vm = form.vm as unknown as { setSlugError(m: string): void }
    vm.setSlugError('该站点地址已被占用，请更换')
    await sleep(150) // ElFormItem 100ms 防抖
    expect(wrapper.text()).toContain('该站点地址已被占用，请更换')
  })
})

describe('TemplateSelect', () => {
  it('按分组渲染全部模板，默认选中传入 id', () => {
    const wrapper = mount(TemplateSelect, { props: { modelValue: 'blank' } })
    const cards = wrapper.findAll('.template-select__card')
    expect(cards.length).toBeGreaterThanOrEqual(12)
    expect(wrapper.find('.template-select__card.is-selected').exists()).toBe(true)
    // 分组标题（templates.ts categoryLabels）
    expect(wrapper.text()).toContain('空白')
    expect(wrapper.text()).toContain('落地页')
  })

  it('点卡 → emit update:modelValue', async () => {
    const wrapper = mount(TemplateSelect, { props: { modelValue: 'blank' } })
    const target = wrapper.findAll('.template-select__card').find((c) => c.text().includes('SaaS 产品落地页'))!
    await target.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['saas-landing']])
  })
})

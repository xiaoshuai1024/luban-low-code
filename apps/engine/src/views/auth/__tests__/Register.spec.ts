/**
 * Register.spec.ts — 注册两步页状态机单测（signup-billing-onboarding T-eng-2）。
 *
 * 覆盖（§4.2.1/§9.5）：
 *  - Step1 四字段逐字段失焦校验 + 提交整单校验（不合法不调 API）；
 *  - register 201 → Step2（emailMasked + 六格 OTP + 60s 倒计时禁用重发）；
 *  - 409 USERNAME_TAKEN/EMAIL_TAKEN → 字段内联错误；429/503 → 顶部 ElAlert；
 *  - OTP 粘贴铺开 / 未填满提交提示 / VERIFY_CODE_INVALID 剩余次数提示；
 *  - verifyCode 成功 → setToken+setAuth → onboarding gate 跳 /onboarding（关→/dashboard）；
 *  - 重发冷却（countdown>0 不发）与到期可重发（fake timers）；
 *  - FeatureGate signup=false → 整卡替换「注册暂未开放」。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import axios from 'axios'

// === stubs：vue-router（Register 用 useRouter）===
const { routerReplace, routerPush, featureFlags, setTokenMock, registerMock, verifyCodeMock, resendCodeMock } =
  vi.hoisted(() => ({
    routerReplace: vi.fn(),
    routerPush: vi.fn(),
    featureFlags: { signup: true, onboarding: true } as Record<string, boolean>,
    setTokenMock: vi.fn(),
    registerMock: vi.fn(),
    verifyCodeMock: vi.fn(),
    resendCodeMock: vi.fn(),
  }))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush, replace: routerReplace }),
}))

// === FeatureGate mock（signup/onboarding 可逐测试改）===
vi.mock('@/config/features', () => ({
  isFeatureEnabled: (key: string) => featureFlags[key] ?? true,
}))

// === @/api/request：保留真实 extractApiError（错误体归一是被测逻辑），mock setToken ===
vi.mock('@/api/request', async () => {
  const actual = await vi.importActual<typeof import('@/api/request')>('@/api/request')
  return { ...actual, setToken: setTokenMock }
})

// === @/api/auth mock ===
vi.mock('@/api/auth', () => ({
  register: (...args: unknown[]) => registerMock(...args),
  verifyCode: (...args: unknown[]) => verifyCodeMock(...args),
  resendCode: (...args: unknown[]) => resendCodeMock(...args),
}))

import Register from '../Register.vue'

/** 构造带 BFF 错误体 {code,message,details?} 的 axios 错误 */
function apiError(
  status: number,
  body: { code?: string; message: string; details?: Record<string, unknown> },
) {
  return new axios.AxiosError(body.message, 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    data: body,
  } as never)
}

/** vue-router 被 mock 后 RouterLink 无全局注册 → 用锚点 stub 断言跳转目标 */
const RouterLinkStub = { props: ['to'], template: '<a :href="to"><slot /></a>' }

/** ElFormItem 的错误展示有 100ms refDebounced 防抖，断言前等待 */
async function waitFieldError() {
  await new Promise((r) => setTimeout(r, 150))
}

function mountRegister() {
  return mount(Register, {
    global: { plugins: [createPinia()], components: { RouterLink: RouterLinkStub } },
  })
}

function fillForm(wrapper: ReturnType<typeof mountRegister>) {
  const inputs = wrapper.findAll('input')
  // ElInput 渲染顺序 = 表单字段顺序：用户名/邮箱/密码/确认密码（show-password 不加额外 input）
  const [username, email, password, confirm] = inputs
  void confirm
  return { username, email, password }
}

async function submitValidForm(wrapper: ReturnType<typeof mountRegister>) {
  const { username, email, password } = fillForm(wrapper)
  await username.setValue('alice')
  await email.setValue('alice@example.com')
  await password.setValue('pass1234')
  const confirmInput = wrapper.findAll('input')[3]
  await confirmInput.setValue('pass1234')
  const btn = wrapper.findAll('button').find((b) => b.text().replace(/\s/g, '').includes('注册'))
  await btn!.trigger('click')
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  featureFlags.signup = true
  featureFlags.onboarding = true
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Register.vue Step1 表单', () => {
  it('默认渲染四字段表单 + 底部去登录链接', () => {
    const wrapper = mountRegister()
    expect(wrapper.find('input[placeholder^="3-32"]').exists()).toBe(true)
    // autocomplete：四字段分别 username/email/new-password/new-password
    expect(wrapper.find('input[placeholder^="3-32"]').attributes('autocomplete')).toBe('username')
    expect(wrapper.find('input[placeholder^="用于接收"]').attributes('autocomplete')).toBe('email')
    expect(wrapper.find('input[placeholder^="至少 8 位"]').attributes('autocomplete')).toBe('new-password')
    expect(wrapper.find('input[placeholder="再次输入密码"]').attributes('autocomplete')).toBe('new-password')
    expect(wrapper.text()).toContain('创建账号')
    expect(wrapper.text()).toContain('已有账号')
    const link = wrapper.find('a[href="/login"]')
    expect(link.exists()).toBe(true)
    expect(wrapper.find('.register-page__otp-box').exists()).toBe(false)
  })

  it('用户名失焦格式校验 → 内联错误；修正后清除', async () => {
    const wrapper = mountRegister()
    const { username } = fillForm(wrapper)
    await username.setValue('AB')
    await username.trigger('blur')
    await waitFieldError()
    expect(wrapper.text()).toContain('用户名需为 3-32 位小写字母')
    await username.setValue('alice')
    await username.trigger('blur')
    await waitFieldError()
    expect(wrapper.text()).not.toContain('用户名需为 3-32 位小写字母')
  })

  it('邮箱/密码强度/两次不一致 逐字段错误', async () => {
    const wrapper = mountRegister()
    const { email, password } = fillForm(wrapper)
    await email.setValue('not-an-email')
    await email.trigger('blur')
    await waitFieldError()
    expect(wrapper.text()).toContain('邮箱格式不正确')
    await password.setValue('short')
    await password.trigger('blur')
    await waitFieldError()
    expect(wrapper.text()).toContain('密码至少 8 位')
    const confirmInput = wrapper.findAll('input')[3]
    await confirmInput.setValue('other999')
    await confirmInput.trigger('blur')
    await waitFieldError()
    expect(wrapper.text()).toContain('两次输入的密码不一致')
  })

  it('整单校验失败 → 不调 register', async () => {
    const wrapper = mountRegister()
    const btn = wrapper.findAll('button').find((b) => b.text().replace(/\s/g, '').includes('注册'))
    await btn!.trigger('click')
    await flushPromises()
    expect(registerMock).not.toHaveBeenCalled()
  })

  it('register 成功 → Step2：掩码邮箱 + 六格 OTP + 倒计时禁用重发', async () => {
    registerMock.mockResolvedValue({
      data: { username: 'alice', emailMasked: 'a***@example.com' },
    })
    const wrapper = mountRegister()
    await submitValidForm(wrapper)

    expect(registerMock).toHaveBeenCalledWith({
      username: 'alice',
      email: 'alice@example.com',
      password: 'pass1234',
    })
    expect(wrapper.text()).toContain('验证码已发送至 a***@example.com')
    const boxes = wrapper.findAll('.register-page__otp-box')
    expect(boxes).toHaveLength(6)
    // 60s 倒计时内重发禁用
    const resendBtn = wrapper.findAll('button').find((b) => b.text().includes('重新发送'))
    expect(resendBtn!.attributes('disabled')).toBeDefined()
    expect(resendBtn!.text()).toContain('60s')
    expect(resendCodeMock).not.toHaveBeenCalled()
  })

  it('409 USERNAME_TAKEN → 用户名字段内联错误', async () => {
    registerMock.mockRejectedValue(
      apiError(409, { code: 'USERNAME_TAKEN', message: '用户名已被占用' }),
    )
    const wrapper = mountRegister()
    await submitValidForm(wrapper)
    await waitFieldError()
    expect(wrapper.text()).toContain('用户名已被占用，请换一个试试')
    // 仍停留 Step1
    expect(wrapper.find('.register-page__otp-box').exists()).toBe(false)
  })

  it('409 EMAIL_TAKEN → 邮箱字段内联错误', async () => {
    registerMock.mockRejectedValue(apiError(409, { code: 'EMAIL_TAKEN', message: '邮箱已被注册' }))
    const wrapper = mountRegister()
    await submitValidForm(wrapper)
    await waitFieldError()
    expect(wrapper.text()).toContain('该邮箱已被注册')
  })

  it('429 RATE_LIMITED → 顶部 ElAlert「操作过于频繁」', async () => {
    registerMock.mockRejectedValue(apiError(429, { code: 'RATE_LIMITED', message: 'Too many requests' }))
    const wrapper = mountRegister()
    await submitValidForm(wrapper)
    expect(wrapper.find('.register-page__alert').exists()).toBe(true)
    expect(wrapper.text()).toContain('操作过于频繁，请稍后再试')
  })

  it('503 EMAIL_SERVICE_UNAVAILABLE → 顶部 ElAlert「邮件服务暂不可用」', async () => {
    registerMock.mockRejectedValue(
      apiError(503, { code: 'EMAIL_SERVICE_UNAVAILABLE', message: 'smtp down' }),
    )
    const wrapper = mountRegister()
    await submitValidForm(wrapper)
    expect(wrapper.text()).toContain('邮件服务暂不可用，请稍后再试')
  })
})

describe('Register.vue Step2 OTP', () => {
  async function mountAtOtp() {
    registerMock.mockResolvedValue({
      data: { username: 'alice', emailMasked: 'a***@example.com' },
    })
    const wrapper = mountRegister()
    await submitValidForm(wrapper)
    return wrapper
  }

  it('粘贴整段验证码 → 六格铺开', async () => {
    const wrapper = await mountAtOtp()
    const boxes = wrapper.findAll('.register-page__otp-box')
    await boxes[0].setValue('123456')
    for (let i = 0; i < 6; i++) {
      expect((boxes[i].element as HTMLInputElement).value).toBe(String(i + 1))
    }
    // autocomplete：仅首格 one-time-code，其余 off
    expect(boxes[0].attributes('autocomplete')).toBe('one-time-code')
    expect(boxes[1].attributes('autocomplete')).toBe('off')
  })

  it('粘贴到中间格 → 从该格起铺开（不覆盖其前的格）', async () => {
    const wrapper = await mountAtOtp()
    const boxes = wrapper.findAll('.register-page__otp-box')
    await boxes[0].setValue('1')
    await boxes[2].setValue('789')
    expect((boxes[0].element as HTMLInputElement).value).toBe('1')
    expect((boxes[2].element as HTMLInputElement).value).toBe('7')
    expect((boxes[3].element as HTMLInputElement).value).toBe('8')
    expect((boxes[4].element as HTMLInputElement).value).toBe('9')
    expect((boxes[5].element as HTMLInputElement).value).toBe('')
  })

  it('聚焦任意格 → 全选该格内容（防粘贴与旧值拼接误判）', async () => {
    const wrapper = await mountAtOtp()
    const boxes = wrapper.findAll('.register-page__otp-box')
    await boxes[0].setValue('1')
    const selectSpy = vi.spyOn(boxes[1].element as HTMLInputElement, 'select')
    await boxes[1].trigger('focus')
    expect(selectSpy).toHaveBeenCalled()
  })

  it('insertFromPaste 输入事件 → 按粘贴内容铺开，不拼接格内旧值', async () => {
    const wrapper = await mountAtOtp()
    const boxes = wrapper.findAll('.register-page__otp-box')
    // 格内留旧数字，模拟未全选时的真粘贴：以 InputEvent.data 为准
    await boxes[0].setValue('9')
    boxes[0].element.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: '123456' }),
    )
    await flushPromises()
    for (let i = 0; i < 6; i++) {
      expect((boxes[i].element as HTMLInputElement).value).toBe(String(i + 1))
    }
  })

  it('Backspace：空格退格 → 清除前一格并回焦前一格', async () => {
    const wrapper = await mountAtOtp()
    const boxes = wrapper.findAll('.register-page__otp-box')
    await boxes[0].setValue('1')
    await boxes[1].setValue('2')
    const focusSpy = vi.spyOn(boxes[1].element as HTMLInputElement, 'focus')
    // 第 3 格（空）按 Backspace → 第 2 格清空并回焦
    await boxes[2].trigger('keydown', { key: 'Backspace' })
    expect((boxes[0].element as HTMLInputElement).value).toBe('1')
    expect((boxes[1].element as HTMLInputElement).value).toBe('')
    expect(focusSpy).toHaveBeenCalled()
  })

  it('未填满提交 → 「请输入完整的 6 位验证码」', async () => {
    const wrapper = await mountAtOtp()
    await wrapper.findAll('.register-page__otp-box')[0].setValue('1')
    const btn = wrapper.findAll('button').find((b) => b.text().includes('验证并登录'))
    await btn!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('请输入完整的 6 位验证码')
    expect(verifyCodeMock).not.toHaveBeenCalled()
  })

  it('verifyCode 成功 → setToken+setAuth+replace(/onboarding)', async () => {
    const wrapper = await mountAtOtp()
    await wrapper.findAll('.register-page__otp-box')[0].setValue('123456')
    verifyCodeMock.mockResolvedValue({
      data: { token: 'jwt-1', user: { username: 'alice', role: 'user' } },
    })
    const btn = wrapper.findAll('button').find((b) => b.text().includes('验证并登录'))
    await btn!.trigger('click')
    await flushPromises()

    expect(verifyCodeMock).toHaveBeenCalledWith({ email: 'alice@example.com', code: '123456' })
    expect(setTokenMock).toHaveBeenCalledWith('jwt-1')
    expect(routerReplace).toHaveBeenCalledWith('/onboarding')
  })

  it('onboarding gate 关闭 → verify 成功直跳 /dashboard', async () => {
    featureFlags.onboarding = false
    const wrapper = await mountAtOtp()
    await wrapper.findAll('.register-page__otp-box')[0].setValue('123456')
    verifyCodeMock.mockResolvedValue({ data: { token: 'jwt-1', user: { username: 'alice' } } })
    const btn = wrapper.findAll('button').find((b) => b.text().includes('验证并登录'))
    await btn!.trigger('click')
    await flushPromises()
    expect(routerReplace).toHaveBeenCalledWith('/dashboard')
  })

  it('VERIFY_CODE_INVALID + remainingAttempts → 剩余次数提示 + OTP 红框', async () => {
    const wrapper = await mountAtOtp()
    await wrapper.findAll('.register-page__otp-box')[0].setValue('123456')
    verifyCodeMock.mockRejectedValue(
      apiError(400, {
        code: 'VERIFY_CODE_INVALID',
        message: '验证码错误',
        details: { remainingAttempts: 3 },
      }),
    )
    const btn = wrapper.findAll('button').find((b) => b.text().includes('验证并登录'))
    await btn!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('验证码错误，还可尝试 3 次')
    expect(wrapper.find('.register-page__otp.is-error').exists()).toBe(true)
    // a11y：六格标 aria-invalid，错误文案 role=alert
    const boxes = wrapper.findAll('.register-page__otp-box')
    expect(boxes[0].attributes('aria-invalid')).toBe('true')
    const errP = wrapper.find('.register-page__otp-error')
    expect(errP.attributes('role')).toBe('alert')
  })

  it('VERIFY_ATTEMPTS_EXCEEDED → 文案+红框；重发成功后清空六格旧数字', async () => {
    vi.useFakeTimers()
    registerMock.mockResolvedValue({
      data: { username: 'alice', emailMasked: 'a***@example.com' },
    })
    const wrapper = mountRegister()
    await submitValidForm(wrapper)
    const boxes = () => wrapper.findAll('.register-page__otp-box')

    await boxes()[0].setValue('123456')
    verifyCodeMock.mockRejectedValue(
      apiError(400, { code: 'VERIFY_ATTEMPTS_EXCEEDED', message: 'too many attempts' }),
    )
    const btn = wrapper.findAll('button').find((b) => b.text().includes('验证并登录'))
    await btn!.trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    expect(wrapper.text()).toContain('验证码尝试次数已达上限，请重新发送验证码')
    expect(wrapper.find('.register-page__otp.is-error').exists()).toBe(true)

    // 倒计时到期 → 重发成功 → 六格旧数字清空、错误态消除
    await vi.advanceTimersByTimeAsync(60_000)
    resendCodeMock.mockResolvedValue({ data: { emailMasked: 'a***@example.com' } })
    const resendBtn = wrapper.findAll('button').find((b) => b.text().includes('重新发送'))!
    await resendBtn.trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    for (let i = 0; i < 6; i++) {
      expect((boxes()[i].element as HTMLInputElement).value).toBe('')
    }
    expect(wrapper.find('.register-page__otp.is-error').exists()).toBe(false)
  })

  it('VERIFY_CODE_EXPIRED → 提示重新发送', async () => {
    const wrapper = await mountAtOtp()
    await wrapper.findAll('.register-page__otp-box')[0].setValue('123456')
    verifyCodeMock.mockRejectedValue(
      apiError(400, { code: 'VERIFY_CODE_EXPIRED', message: 'expired' }),
    )
    const btn = wrapper.findAll('button').find((b) => b.text().includes('验证并登录'))
    await btn!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('验证码已过期，请重新发送')
  })

  it('倒计时到期后可重发；重发成功重新计时', async () => {
    vi.useFakeTimers()
    registerMock.mockResolvedValue({
      data: { username: 'alice', emailMasked: 'a***@example.com' },
    })
    const wrapper = mountRegister()
    await submitValidForm(wrapper)
    // flushPromises 受 fake timers 影响，用 advanceTimersByTimeAsync 冲刷微任务
    // （submitValidForm 内已 await，register promise 已 resolve）

    const resendBtn = () =>
      wrapper.findAll('button').find((b) => b.text().includes('重新发送'))!
    expect(resendBtn().attributes('disabled')).toBeDefined()

    await vi.advanceTimersByTimeAsync(60_000)
    expect(resendBtn().attributes('disabled')).toBeUndefined()

    resendCodeMock.mockResolvedValue({
      data: { username: 'alice', emailMasked: 'a***@example.com' },
    })
    await resendBtn().trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    expect(resendCodeMock).toHaveBeenCalledWith({ email: 'alice@example.com' })
    // 重发后重新进入 60s 冷却
    expect(resendBtn().text()).toContain('60s')
  })

  it('重发 429 冷却 → 顶部提示', async () => {
    vi.useFakeTimers()
    registerMock.mockResolvedValue({
      data: { username: 'alice', emailMasked: 'a***@example.com' },
    })
    const wrapper = mountRegister()
    await submitValidForm(wrapper)
    await vi.advanceTimersByTimeAsync(60_000)
    resendCodeMock.mockRejectedValue(
      apiError(429, { code: 'VERIFY_RESEND_COOLDOWN', message: 'cooldown' }),
    )
    const btn = wrapper.findAll('button').find((b) => b.text().includes('重新发送'))!
    await btn.trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    expect(wrapper.text()).toContain('发送过于频繁，请稍后再试')
  })
})

describe('Register.vue FeatureGate signup=false', () => {
  it('整卡替换「注册暂未开放」+ 去登录按钮，无表单', async () => {
    featureFlags.signup = false
    const wrapper = mountRegister()
    expect(wrapper.text()).toContain('注册暂未开放')
    expect(wrapper.text()).toContain('请联系管理员')
    expect(wrapper.find('input').exists()).toBe(false)
    const btn = wrapper.findAll('button').find((b) => b.text().includes('去登录'))
    expect(btn).toBeDefined()
    await btn!.trigger('click')
    expect(routerPush).toHaveBeenCalledWith('/login')
  })
})

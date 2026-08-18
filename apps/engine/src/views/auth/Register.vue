<script setup lang="ts">
/**
 * Register.vue — 自助注册两步页（signup-billing-onboarding §4.2.1/§4.3）。
 *
 * Step1 表单：用户名/邮箱/密码/确认密码，逐字段失焦校验 + 提交整单校验；
 *   409 USERNAME_TAKEN/EMAIL_TAKEN → 字段内联错误；429/503 → 顶部 ElAlert。
 * Step2 OTP：六格验证码（自动进格/退格/粘贴铺开）、60s 倒计时重发、剩余次数提示；
 *   verify 成功 setToken+setAuth → 按 onboarding gate 跳 /onboarding 或 /dashboard。
 *
 * FeatureGate（§6.5）：signup=false → 整卡替换「注册暂未开放，请联系管理员」。
 * 样式复刻 Login.vue 居中卡片（420px + 同款渐变背景）。
 */
import { nextTick, onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ElAlert,
  ElButton,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElStep,
  ElSteps,
} from 'element-plus'
import { register, resendCode, verifyCode } from '@/api/auth'
import { extractApiError, setToken } from '@/api/request'
import { useUserStore } from '@/stores'
import { isFeatureEnabled } from '@/config/features'

const router = useRouter()
const userStore = useUserStore()

/** FeatureGate：signup 关闭 → 整卡替换（回滚首选手段，§6.5） */
const signupEnabled = isFeatureEnabled('signup')

type Step = 'form' | 'otp'
const step = ref<Step>('form')

const form = reactive({ username: '', email: '', password: '', confirmPassword: '' })
const fieldErrors = reactive<{ username?: string; email?: string; password?: string; confirmPassword?: string }>({})
/** 顶部 ElAlert：429/503/服务端消息（Step1/Step2 共用） */
const topError = ref('')
/** OTP 区红框 + 行内错误（VERIFY_* 系列） */
const otpError = ref('')

const submitting = ref(false)
const verifying = ref(false)
const resending = ref(false)

const emailMasked = ref('')
const countdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null

/** 六格 OTP（模板 ref 数组，自动进格/退格依赖 focus 控制） */
const otpDigits = reactive(['', '', '', '', '', ''])
const otpInputs = ref<HTMLInputElement[]>([])

const USERNAME_RE = /^[a-z0-9_-]{3,32}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// === 逐字段校验（失焦 + 提交整单） ===
function validateUsername(): boolean {
  if (!form.username) {
    fieldErrors.username = '请输入用户名'
    return false
  }
  if (!USERNAME_RE.test(form.username)) {
    fieldErrors.username = '用户名需为 3-32 位小写字母、数字、下划线或短横线'
    return false
  }
  fieldErrors.username = undefined
  return true
}

function validateEmail(): boolean {
  if (!form.email) {
    fieldErrors.email = '请输入邮箱'
    return false
  }
  if (!EMAIL_RE.test(form.email)) {
    fieldErrors.email = '邮箱格式不正确，请检查后重试'
    return false
  }
  fieldErrors.email = undefined
  return true
}

function validatePassword(): boolean {
  if (!form.password) {
    fieldErrors.password = '请输入密码'
    return false
  }
  if (form.password.length < 8 || !/[a-zA-Z]/.test(form.password) || !/\d/.test(form.password)) {
    fieldErrors.password = '密码至少 8 位，且需同时包含字母和数字'
    return false
  }
  fieldErrors.password = undefined
  return true
}

function validateConfirmPassword(): boolean {
  if (!form.confirmPassword) {
    fieldErrors.confirmPassword = '请再次输入密码'
    return false
  }
  if (form.confirmPassword !== form.password) {
    fieldErrors.confirmPassword = '两次输入的密码不一致'
    return false
  }
  fieldErrors.confirmPassword = undefined
  return true
}

function validateField(name: keyof typeof fieldErrors): void {
  if (name === 'username') validateUsername()
  else if (name === 'email') validateEmail()
  else if (name === 'password') validatePassword()
  else validateConfirmPassword()
}

function validateAll(): boolean {
  return (
    validateUsername() && validateEmail() && validatePassword() && validateConfirmPassword()
  )
}

// === Step1 → Step2 ===
async function submitRegister(): Promise<void> {
  topError.value = ''
  if (!validateAll()) return
  submitting.value = true
  try {
    const { data } = await register({
      username: form.username,
      email: form.email,
      password: form.password,
    })
    emailMasked.value = data.emailMasked
    step.value = 'otp'
    startCountdown()
    await nextTick()
    otpInputs.value[0]?.focus()
  } catch (e) {
    const api = extractApiError(e)
    switch (api.code) {
      case 'USERNAME_TAKEN':
        fieldErrors.username = '用户名已被占用，请换一个试试'
        break
      case 'EMAIL_TAKEN':
        fieldErrors.email = '该邮箱已被注册，可直接登录'
        break
      case 'WEAK_PASSWORD':
        fieldErrors.password = '密码强度不足：至少 8 位且同时包含字母和数字'
        break
      case 'RATE_LIMITED':
        topError.value = '操作过于频繁，请稍后再试'
        break
      case 'EMAIL_SERVICE_UNAVAILABLE':
        topError.value = '邮件服务暂不可用，请稍后再试'
        break
      default:
        topError.value = api.message || '请求失败，请稍后重试'
    }
  } finally {
    submitting.value = false
  }
}

// === OTP 六格交互 ===
/** 聚焦即全选：任何键入/粘贴都整体替换当前格，避免旧数字与粘贴内容拼接误判 */
function onOtpFocus(e: FocusEvent): void {
  ;(e.target as HTMLInputElement).select()
}

function onOtpInput(i: number, e: Event): void {
  const ev = e as InputEvent
  // 真粘贴取 InputEvent.data（纯粘贴内容，不受格内旧值拼接影响）；
  // 普通键入取整格 value（focus 全选后即单个新数字）
  const source =
    ev.inputType === 'insertFromPaste' && typeof ev.data === 'string'
      ? ev.data
      : (e.target as HTMLInputElement).value
  const raw = source.replace(/\D/g, '')
  if (!raw) {
    // 键入非数字/清空：同步清 model，避免 v-model 已写入的非法字符残留进 join('') 的验证码
    otpDigits[i] = ''
    otpError.value = ''
    return
  }
  if (raw.length > 1) {
    // 粘贴整段验证码：从第 i 格起铺开（超出第 6 格截断）
    for (let k = 0; k < raw.length && i + k < 6; k++) otpDigits[i + k] = raw[k]
    otpInputs.value[Math.min(i + raw.length - 1, 5)]?.focus()
  } else {
    otpDigits[i] = raw
    if (i < 5) otpInputs.value[i + 1]?.focus()
  }
  otpError.value = ''
}

function onOtpKeydown(i: number, e: KeyboardEvent): void {
  if (e.key === 'Backspace' && !otpDigits[i] && i > 0) {
    e.preventDefault()
    otpDigits[i - 1] = ''
    otpError.value = ''
    otpInputs.value[i - 1]?.focus()
  }
}

// === 重发（60s 冷却倒计时） ===
function startCountdown(): void {
  countdown.value = 60
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0 && countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }, 1000)
}

async function resend(): Promise<void> {
  if (countdown.value > 0 || resending.value) return
  topError.value = ''
  otpError.value = ''
  resending.value = true
  try {
    const { data } = await resendCode({ email: form.email })
    emailMasked.value = data.emailMasked
    // 旧验证码已作废（如 VERIFY_ATTEMPTS_EXCEEDED 后重发）：清空六格旧数字重输
    for (let k = 0; k < 6; k++) otpDigits[k] = ''
    otpError.value = ''
    otpInputs.value[0]?.focus()
    startCountdown()
    ElMessage.success('验证码已重新发送')
  } catch (e) {
    const api = extractApiError(e)
    switch (api.code) {
      case 'VERIFY_RESEND_COOLDOWN':
      case 'RATE_LIMITED':
        topError.value = '发送过于频繁，请稍后再试'
        break
      case 'VERIFY_RESEND_DAILY_LIMIT':
        topError.value = '今日发送次数已达上限，请明天再试'
        break
      case 'EMAIL_SERVICE_UNAVAILABLE':
        topError.value = '邮件服务暂不可用，请稍后再试'
        break
      default:
        topError.value = api.message || '请求失败，请稍后重试'
    }
  } finally {
    resending.value = false
  }
}

// === Step2 提交验证 → 自动登录 → 跳向导/工作台 ===
async function submitVerify(): Promise<void> {
  topError.value = ''
  otpError.value = ''
  const code = otpDigits.join('')
  if (code.length < 6) {
    otpError.value = '请输入完整的 6 位验证码'
    return
  }
  verifying.value = true
  try {
    const { data } = await verifyCode({ email: form.email, code })
    setToken(data.token)
    userStore.setAuth(data.token, data.user)
    ElMessage.success('注册成功')
    // FeatureGate onboarding：关闭时直进工作台（Dashboard 空态 CTA 兜底建站，§6.5）
    router.replace(isFeatureEnabled('onboarding') ? '/onboarding' : '/dashboard')
  } catch (e) {
    const api = extractApiError(e)
    const remaining = api.details?.remainingAttempts
    switch (api.code) {
      case 'VERIFY_CODE_INVALID':
        otpError.value =
          typeof remaining === 'number' ? `验证码错误，还可尝试 ${remaining} 次` : '验证码错误，请检查后重试'
        break
      case 'VERIFY_CODE_EXPIRED':
        otpError.value = '验证码已过期，请重新发送后再试'
        break
      case 'VERIFY_ATTEMPTS_EXCEEDED':
        otpError.value = '验证码尝试次数已达上限，请重新发送验证码'
        break
      case 'RATE_LIMITED':
        topError.value = '操作过于频繁，请稍后再试'
        break
      default:
        otpError.value = api.message || '请求失败，请稍后重试'
    }
  } finally {
    verifying.value = false
  }
}

onUnmounted(() => {
  if (countdownTimer) clearInterval(countdownTimer)
})

function goLogin(): void {
  router.push('/login')
}
</script>

<template>
  <div class="register-page">
    <div class="register-page__card">
      <!-- FeatureGate signup=false：整卡替换（§4.3） -->
      <template v-if="!signupEnabled">
        <h1 class="register-page__title">注册暂未开放</h1>
        <p class="register-page__subtitle">请联系管理员开通账号</p>
        <ElButton type="primary" size="large" class="register-page__btn" @click="goLogin">
          去登录
        </ElButton>
      </template>

      <template v-else>
        <div class="register-page__brand">Luban</div>
        <h1 class="register-page__title">{{ step === 'form' ? '创建账号' : '验证邮箱' }}</h1>
        <p class="register-page__subtitle">
          {{ step === 'form' ? '注册即可免费开通第一个站点' : '输入邮箱收到的 6 位验证码完成注册' }}
        </p>

        <!-- Step2 顶部两步指示（§4.3） -->
        <ElSteps v-if="step === 'otp'" :active="1" simple finish-status="success" class="register-page__steps">
          <ElStep title="填写信息" />
          <ElStep title="验证邮箱" />
        </ElSteps>

        <ElAlert
          v-if="topError"
          :title="topError"
          type="error"
          show-icon
          :closable="false"
          class="register-page__alert"
        />

        <!-- Step1：账号信息表单 -->
        <ElForm v-if="step === 'form'" :model="form" label-position="top" class="register-page__form">
          <ElFormItem label="用户名" :error="fieldErrors.username">
            <ElInput
              v-model="form.username"
              placeholder="3-32 位小写字母、数字、下划线或短横线"
              size="large"
              autocomplete="username"
              @blur="validateField('username')"
            />
          </ElFormItem>
          <ElFormItem label="邮箱" :error="fieldErrors.email">
            <ElInput
              v-model="form.email"
              placeholder="用于接收验证码，如 name@example.com"
              size="large"
              autocomplete="email"
              @blur="validateField('email')"
            />
          </ElFormItem>
          <ElFormItem label="密码" :error="fieldErrors.password">
            <ElInput
              v-model="form.password"
              type="password"
              placeholder="至少 8 位，且同时包含字母和数字"
              size="large"
              show-password
              autocomplete="new-password"
              @blur="validateField('password')"
            />
          </ElFormItem>
          <ElFormItem label="确认密码" :error="fieldErrors.confirmPassword">
            <ElInput
              v-model="form.confirmPassword"
              type="password"
              placeholder="再次输入密码"
              size="large"
              show-password
              autocomplete="new-password"
              @blur="validateField('confirmPassword')"
              @keyup.enter="submitRegister"
            />
          </ElFormItem>
          <ElFormItem>
            <ElButton
              type="primary"
              size="large"
              class="register-page__btn"
              :loading="submitting"
              @click="submitRegister"
            >
              注 册
            </ElButton>
          </ElFormItem>
        </ElForm>

        <!-- Step2：六格 OTP -->
        <div v-else class="register-page__otp-step" @keydown.enter.prevent="submitVerify">
          <p class="register-page__otp-tip">验证码已发送至 {{ emailMasked }}</p>
          <div class="register-page__otp" :class="{ 'is-error': !!otpError }">
            <input
              v-for="(_, i) in 6"
              :key="i"
              :ref="(el) => { if (el) otpInputs[i] = el as HTMLInputElement }"
              v-model="otpDigits[i]"
              class="register-page__otp-box"
              type="text"
              inputmode="numeric"
              :autocomplete="i === 0 ? 'one-time-code' : 'off'"
              maxlength="6"
              :aria-label="`验证码第 ${i + 1} 位`"
              :aria-invalid="!!otpError"
              @focus="onOtpFocus"
              @input="onOtpInput(i, $event)"
              @keydown="onOtpKeydown(i, $event)"
            />
          </div>
          <p v-if="otpError" class="register-page__otp-error" role="alert">{{ otpError }}</p>
          <ElButton
            class="register-page__resend"
            :disabled="countdown > 0"
            :loading="resending"
            @click="resend"
          >
            {{ countdown > 0 ? `重新发送（${countdown}s）` : '重新发送验证码' }}
          </ElButton>
          <ElButton
            type="primary"
            size="large"
            class="register-page__btn"
            :loading="verifying"
            @click="submitVerify"
          >
            验证并登录
          </ElButton>
        </div>

        <div class="register-page__footer">
          <span>已有账号？</span>
          <router-link to="/login" class="register-page__footer-link">去登录</router-link>
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* 复刻 Login.vue：居中卡片 + 同款渐变背景 */
.register-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.register-page__card {
  width: 100%;
  max-width: 420px;
  padding: 40px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

.register-page__brand {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 2px;
  color: #4f46e5;
  text-align: center;
  text-transform: uppercase;
}

.register-page__title {
  margin: 8px 0 8px;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  text-align: center;
}

.register-page__subtitle {
  margin: 0 0 16px;
  font-size: 14px;
  color: #909399;
  text-align: center;
}

.register-page__steps {
  margin-bottom: 16px;
}

.register-page__alert {
  margin-bottom: 16px;
}

.register-page__form {
  margin-top: 8px;
}

.register-page__btn {
  width: 100%;
  margin-top: 4px;
}

/* Step2 OTP */
.register-page__otp-step {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
}

.register-page__otp-tip {
  margin: 0 0 16px;
  font-size: 14px;
  color: #606266;
  text-align: center;
}

.register-page__otp {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.register-page__otp-box {
  width: 44px;
  height: 48px;
  box-sizing: border-box;
  text-align: center;
  font-size: 20px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  color: #303133;
  background: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  outline: none;
  transition: border-color 0.2s;

  &:focus {
    border-color: #409eff;
  }
}

.register-page__otp.is-error .register-page__otp-box {
  border-color: #f56c6c;
}

.register-page__otp-error {
  margin: 8px 0 0;
  font-size: 12px;
  color: #f56c6c;
  text-align: center;
}

.register-page__resend {
  align-self: center;
  margin: 16px 0 0;
}

.register-page__footer {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
  font-size: 14px;
  color: #909399;
  text-align: center;
}

.register-page__footer-link {
  color: #409eff;
  text-decoration: none;
  margin-left: 4px;

  &:hover {
    text-decoration: underline;
  }
}
</style>

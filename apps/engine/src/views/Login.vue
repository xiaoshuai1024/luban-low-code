<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElForm, ElFormItem, ElInput, ElButton, ElMessage } from 'element-plus'
import { useUserStore } from '@/stores'
import { login } from '@/api/auth'
import { setToken } from '@/api/request'
import { isFeatureEnabled } from '@/config/features'

const router = useRouter()
const userStore = useUserStore()

/** signup-billing-onboarding：注册互链受 signup gate 控制（关闭时不展示，§6.5） */
const signupEnabled = isFeatureEnabled('signup')

const form = ref({ username: '', password: '' })
const loading = ref(false)

async function onSubmit() {
  loading.value = true
  try {
    const { data } = await login(form.value)
    setToken(data.token)
    userStore.setAuth(data.token, data.user)
    ElMessage.success('登录成功')
    router.push('/dashboard')
  } catch (e) {
    ElMessage.error((e as Error).message || '登录失败')
  } finally {
    loading.value = false
  }
}

/** 体验账号一键填充（test / test，后台内置） */
function fillDemo() {
  form.value.username = 'test'
  form.value.password = 'test'
}
</script>

<template>
  <div class="login-page">
    <div class="login-page__card">
      <h1 class="login-page__title">Luban 管理后台</h1>
      <p class="login-page__subtitle">请登录</p>
      <ElForm :model="form" label-position="top" class="login-page__form">
        <ElFormItem label="账号">
          <ElInput v-model="form.username" placeholder="请输入账号" size="large" />
        </ElFormItem>
        <ElFormItem label="密码">
          <ElInput v-model="form.password" type="password" placeholder="请输入密码" size="large" show-password @keyup.enter="onSubmit" />
        </ElFormItem>
        <ElFormItem>
          <ElButton type="primary" size="large" :loading="loading" class="login-page__btn" @click="onSubmit">
            登录
          </ElButton>
        </ElFormItem>
      </ElForm>
      <div class="login-page__demo">
        <div class="login-page__demo-title">🎯 体验账号</div>
        <div class="login-page__demo-desc">无需注册，直接登录体验搭建</div>
        <div class="login-page__demo-cred">
          <code>test</code><span class="login-page__demo-sep">/</span><code>test</code>
        </div>
        <ElButton size="small" text type="primary" class="login-page__demo-fill" @click="fillDemo">
          一键填充
        </ElButton>
      </div>
      <div v-if="signupEnabled" class="login-page__register">
        <span>没有账号？</span>
        <router-link to="/register" class="login-page__register-link">免费注册</router-link>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-page__card {
  width: 100%;
  max-width: 420px;
  padding: 40px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

.login-page__title {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  text-align: center;
}

.login-page__subtitle {
  margin: 0 0 24px;
  font-size: 14px;
  color: #909399;
  text-align: center;
}

.login-page__form {
  margin-top: 8px;
}

.login-page__btn {
  width: 100%;
}

/* 体验账号提示卡片 */
.login-page__demo {
  margin-top: 24px;
  padding: 14px 16px;
  border-radius: 8px;
  text-align: center;
  background: #f5f7ff;
  border: 1px dashed #b9c4f7;
}

.login-page__demo-title {
  font-size: 14px;
  font-weight: 600;
  color: #4f46e5;
}

.login-page__demo-desc {
  margin-top: 2px;
  font-size: 12px;
  color: #909399;
}

.login-page__demo-cred {
  margin-top: 8px;
  font-size: 14px;

  code {
    padding: 2px 10px;
    border-radius: 4px;
    background: #fff;
    border: 1px solid #e2e8f0;
    font-family: 'SFMono-Regular', Consolas, monospace;
    color: #303133;
  }
}

.login-page__demo-sep {
  margin: 0 6px;
  color: #c0c4cc;
}

.login-page__demo-fill {
  margin-top: 6px;
}

.login-page__register {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
  font-size: 14px;
  color: #909399;
  text-align: center;
}

.login-page__register-link {
  color: #409eff;
  text-decoration: none;
  margin-left: 4px;

  &:hover {
    text-decoration: underline;
  }
}
</style>

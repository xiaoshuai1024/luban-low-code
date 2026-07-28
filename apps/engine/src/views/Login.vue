<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElForm, ElFormItem, ElInput, ElButton, ElMessage } from 'element-plus'
import { useUserStore } from '@/stores'
import { login } from '@/api/auth'
import { setToken } from '@/api/request'

const router = useRouter()
const userStore = useUserStore()

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
</style>

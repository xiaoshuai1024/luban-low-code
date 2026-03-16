<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElCard, ElForm, ElFormItem, ElInput, ElSwitch, ElButton, ElMessage, ElTabs, ElTabPane } from 'element-plus'
import { getSettings, updateSettings, type SystemSettings } from '@/api/settings'

const loading = ref(false)
const saving = ref(false)
const form = ref<SystemSettings>({
  siteName: '',
  logo: '',
  security: { sessionTimeout: 30 },
  notification: { enabled: true },
})

async function fetchSettings() {
  loading.value = true
  try {
    const { data } = await getSettings()
    form.value = { ...form.value, ...data }
  } catch {
    // keep defaults
  } finally {
    loading.value = false
  }
}

async function onSubmit() {
  saving.value = true
  try {
    await updateSettings(form.value)
    ElMessage.success('保存成功')
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(fetchSettings)
</script>

<template>
  <div class="settings">
    <ElTabs type="border-card">
      <ElTabPane label="基础信息">
        <ElCard shadow="never">
          <ElForm :model="form" label-width="120px" v-loading="loading">
            <ElFormItem label="系统名称">
              <ElInput v-model="form.siteName" placeholder="Luban 管理后台" />
            </ElFormItem>
            <ElFormItem label="Logo URL">
              <ElInput v-model="form.logo" placeholder="https://..." />
            </ElFormItem>
          </ElForm>
        </ElCard>
      </ElTabPane>
      <ElTabPane label="安全">
        <ElCard shadow="never">
          <ElForm :model="form" label-width="120px" v-loading="loading">
            <ElFormItem label="会话超时（分钟）">
              <ElInput
                v-model.number="form.security!.sessionTimeout"
                type="number"
                placeholder="30"
                style="width: 120px"
              />
            </ElFormItem>
          </ElForm>
        </ElCard>
      </ElTabPane>
      <ElTabPane label="通知">
        <ElCard shadow="never">
          <ElForm :model="form" label-width="120px" v-loading="loading">
            <ElFormItem label="启用通知">
              <ElSwitch v-model="form.notification!.enabled" />
            </ElFormItem>
          </ElForm>
        </ElCard>
      </ElTabPane>
    </ElTabs>
    <div class="settings__actions">
      <ElButton type="primary" :loading="saving" @click="onSubmit">保存设置</ElButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.settings__actions {
  margin-top: 20px;
}
</style>

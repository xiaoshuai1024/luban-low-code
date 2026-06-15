<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElRow, ElCol, ElCard, ElStatistic } from 'element-plus'
import { getSites } from '@/api/site'
import { getUsers } from '@/api/user'

const siteCount = ref(0)
const userCount = ref(0)

onMounted(async () => {
    console.log('[Dashboard] onMounted')

  try {
    const [sitesRes, usersRes] = await Promise.all([
      getSites().catch(() => ({ data: [] })),
      getUsers().catch(() => ({ data: { list: [], total: 0 } })),
    ])
    siteCount.value = Array.isArray(sitesRes.data) ? sitesRes.data.length : 0
    userCount.value = usersRes.data?.total ?? 0
  } catch {
    // mock for demo
    siteCount.value = 0
    userCount.value = 0
  }
})
</script>

<template>
  <div class="dashboard">
    <ElRow :gutter="20">
      <ElCol :span="8">
        <ElCard shadow="hover" class="dashboard__card">
          <ElStatistic title="站点数" :value="siteCount" />
        </ElCard>
      </ElCol>
      <ElCol :span="8">
        <ElCard shadow="hover" class="dashboard__card">
          <ElStatistic title="用户数" :value="userCount" />
        </ElCard>
      </ElCol>
      <ElCol :span="8">
        <ElCard shadow="hover" class="dashboard__card">
          <ElStatistic title="页面数" :value="0" />
        </ElCard>
      </ElCol>
    </ElRow>
    <ElRow :gutter="20" style="margin-top: 20px">
      <ElCol :span="24">
        <ElCard shadow="hover">
          <template #header>快捷入口</template>
          <div class="dashboard__links">
            <router-link to="/sites" class="dashboard__link">站点管理</router-link>
            <router-link to="/users" class="dashboard__link">用户管理</router-link>
            <router-link to="/settings" class="dashboard__link">系统设置</router-link>
          </div>
        </ElCard>
      </ElCol>
    </ElRow>
  </div>
</template>

<style lang="scss" scoped>
.dashboard__card {
  margin-bottom: 0;
}

.dashboard__links {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.dashboard__link {
  color: #409eff;
  text-decoration: none;
  font-size: 14px;
  &:hover {
    text-decoration: underline;
  }
}
</style>

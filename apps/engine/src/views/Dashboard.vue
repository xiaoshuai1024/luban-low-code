<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElRow, ElCol, ElCard, ElStatistic } from 'element-plus'
import { getSites } from '@/api/site'
import { getUsers } from '@/api/user'
import { getPages } from '@/api/page'

const siteCount = ref(0)
const userCount = ref(0)
const pageCount = ref(0)

/**
 * 页面数统计：无专用 count 端点（BFF/后端均未提供 stats API），采用
 * sites → getPages(siteId) 聚合求和的最小方案（站点数量级小，N+1 可接受；
 * 单站点失败不拖垮整体，仅按 0 计入）。
 */
async function countPages(siteIds: string[]): Promise<number> {
  const results = await Promise.all(
    siteIds.map((id) =>
      getPages(id)
        .then((r) => (Array.isArray(r.data) ? r.data.length : 0))
        .catch(() => 0),
    ),
  )
  return results.reduce((sum, n) => sum + n, 0)
}

onMounted(async () => {
  const [sitesRes, usersRes] = await Promise.all([
    getSites().catch(() => ({ data: [] as { id: string }[] })),
    getUsers().catch(() => ({ data: { list: [], total: 0 } })),
  ])
  const sites = Array.isArray(sitesRes.data) ? sitesRes.data : []
  siteCount.value = sites.length
  userCount.value = usersRes.data?.total ?? 0
  pageCount.value = await countPages(sites.map((s) => s.id))
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
          <ElStatistic title="页面数" :value="pageCount" />
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

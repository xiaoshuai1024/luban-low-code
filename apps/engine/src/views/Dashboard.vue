<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElRow, ElCol, ElCard, ElStatistic, ElEmpty, ElButton, ElResult } from 'element-plus'
import { getSites } from '@/api/site'
import { getUsers } from '@/api/user'
import { getPages } from '@/api/page'
import { extractApiError } from '@/api/request'

const router = useRouter()

const siteCount = ref(0)
const userCount = ref(0)
const pageCount = ref(0)
/** 区分「加载中」与「确无站点」，避免空态闪现（signup-billing-onboarding §4.2.3） */
const loaded = ref(false)
/** getSites 失败：站点是主数据，失败即整页错误态（不再吞成空态误导开通） */
const loadError = ref('')
/** getUsers 失败：用户数统计不可信，数值显「—」 */
const usersFailed = ref(false)

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

/** getUsers 失败 → 统计不可信，数值显「—」 */
function userFormatter(): string {
  return usersFailed.value ? '—' : String(userCount.value)
}

async function load(): Promise<void> {
  loadError.value = ''
  loaded.value = false
  const [sitesRes, usersRes] = await Promise.all([
    getSites().catch((e) => {
      loadError.value = extractApiError(e).message || '站点数据加载失败，请稍后重试'
      return null
    }),
    getUsers().catch(() => null),
  ])
  if (loadError.value) {
    // 主数据失败 → 错误态 + 重试；统计/空态均不可信，不再展示
    loaded.value = true
    return
  }
  const sites: { id: string }[] = sitesRes && Array.isArray(sitesRes.data) ? sitesRes.data : []
  siteCount.value = sites.length
  usersFailed.value = !usersRes
  userCount.value = usersRes?.data?.total ?? 0
  pageCount.value = await countPages(sites.map((s) => s.id))
  loaded.value = true
}

onMounted(load)
</script>

<template>
  <div class="dashboard" v-loading="!loaded">
    <!-- 错误态：站点主数据加载失败（区别于空态，不再误导开通） -->
    <ElCard v-if="loaded && loadError" shadow="never" class="dashboard__empty">
      <ElResult icon="error" :title="loadError">
        <template #extra>
          <ElButton type="primary" @click="load">重试</ElButton>
        </template>
      </ElResult>
    </ElCard>

    <!-- 空态：仅加载成功且确无站点 → 开通引导（signup-billing-onboarding §4.2.3/§4.3） -->
    <ElCard v-else-if="loaded && siteCount === 0" shadow="never" class="dashboard__empty">
      <ElEmpty description="还没有站点，开通你的第一个站点">
        <ElButton type="primary" size="large" @click="router.push('/onboarding')">免费开通</ElButton>
      </ElEmpty>
    </ElCard>

    <template v-else>
      <ElRow :gutter="20">
        <ElCol :span="8">
          <ElCard shadow="hover" class="dashboard__card">
            <ElStatistic title="站点数" :value="siteCount" />
          </ElCard>
        </ElCol>
        <ElCol :span="8">
          <ElCard shadow="hover" class="dashboard__card">
            <ElStatistic title="用户数" :value="userCount" :formatter="userFormatter" />
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
    </template>
  </div>
</template>

<style lang="scss" scoped>
.dashboard__card {
  margin-bottom: 0;
}

.dashboard__empty {
  min-height: 360px;
  display: flex;
  align-items: center;
  justify-content: center;
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

<script setup lang="ts">
/**
 * VersionHistory.vue — V2-T8 版本历史抽屉。
 *
 * 在 PageEditor 工具栏点「历史」打开；列表展示版本（versionNo/summary/createdAt），
 * 点击版本预览 schema（LubanPage 只读渲染）；「回滚」按钮确认后调 rollback → 父组件重载页面。
 *
 * emit('rollback') 通知父组件重新 loadPage（schema 已被后端覆盖）。
 */
import { ref, watch } from 'vue'
import {
  ElDrawer,
  ElTimeline,
  ElTimelineItem,
  ElButton,
  ElTag,
  ElMessage,
  ElMessageBox,
  ElEmpty,
} from 'element-plus'
import {
  listVersions,
  getVersion,
  rollbackVersion,
  type PageVersionListItem,
  type PageVersionDetail,
} from '@/api/pageVersion'
import type { PageSchema } from '@/types/schema'

const props = defineProps<{
  modelValue: boolean
  siteId: string
  pageId: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'rollback'): void
}>()

const visible = ref(props.modelValue)
watch(() => props.modelValue, (v) => (visible.value = v))
watch(visible, (v) => emit('update:modelValue', v))

const versions = ref<PageVersionListItem[]>([])
const loading = ref(false)
const selectedVersion = ref<PageVersionDetail | null>(null)
const previewSchema = ref<PageSchema | null>(null)

async function fetchVersions() {
  if (!props.siteId || !props.pageId) return
  loading.value = true
  try {
    const { data } = await listVersions(props.siteId, props.pageId)
    versions.value = Array.isArray(data) ? data : []
  } catch (e) {
    versions.value = []
    ElMessage.error((e as Error)?.message || '加载版本失败')
  } finally {
    loading.value = false
  }
}

watch(visible, (v) => {
  if (v) {
    fetchVersions()
    selectedVersion.value = null
    previewSchema.value = null
  }
})

async function onSelectVersion(v: PageVersionListItem) {
  try {
    const { data } = await getVersion(props.siteId, props.pageId, v.id)
    selectedVersion.value = data
    previewSchema.value = data.schema ?? null
  } catch (e) {
    ElMessage.error((e as Error)?.message || '加载版本详情失败')
  }
}

async function onRollback() {
  if (!selectedVersion.value) return
  const v = selectedVersion.value
  try {
    await ElMessageBox.confirm(
      `确定回滚到 v${v.versionNo}？当前页面内容将被覆盖（回滚也会生成一条新版本）。`,
      '版本回滚',
      { type: 'warning', confirmButtonText: '确认回滚', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  try {
    await rollbackVersion(props.siteId, props.pageId, v.id)
    ElMessage.success('已回滚到 v' + v.versionNo)
    emit('rollback')
    visible.value = false
  } catch (e) {
    ElMessage.error((e as Error)?.message || '回滚失败')
  }
}

function formatTime(ts?: string): string {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString('zh-CN')
  } catch {
    return ts
  }
}
</script>

<template>
  <ElDrawer v-model="visible" title="版本历史" size="500px" direction="rtl">
    <div v-loading="loading" class="version-history">
      <div class="version-history__list">
        <ElEmpty v-if="!loading && versions.length === 0" description="暂无版本记录" />
        <ElTimeline>
          <ElTimelineItem
            v-for="v in versions"
            :key="v.id"
            :timestamp="formatTime(v.createdAt)"
            placement="top"
          >
            <div
              class="version-history__item"
              :class="{ 'is-active': selectedVersion?.id === v.id }"
              @click="onSelectVersion(v)"
            >
              <div class="version-history__item-head">
                <ElTag size="small" type="primary">v{{ v.versionNo }}</ElTag>
                <span class="version-history__summary">{{ v.summary || '（无备注）' }}</span>
              </div>
              <div class="version-history__by" v-if="v.createdBy">操作人：{{ v.createdBy }}</div>
            </div>
          </ElTimelineItem>
        </ElTimeline>
      </div>
      <div v-if="selectedVersion" class="version-history__preview">
        <div class="version-history__preview-head">
          <span>v{{ selectedVersion.versionNo }} 预览</span>
          <ElButton type="primary" size="small" @click="onRollback">回滚到此版本</ElButton>
        </div>
        <div class="version-history__preview-canvas">
          <div v-if="previewSchema" class="version-history__preview-html">
            <LubanPageLazy :schema="previewSchema" />
          </div>
          <ElEmpty v-else description="无法加载预览" />
        </div>
      </div>
    </div>
  </ElDrawer>
</template>

<script lang="ts">
// 异步加载 LubanPage 避免 SSR/circular
import { defineAsyncComponent } from 'vue'
const LubanPageLazy = defineAsyncComponent(() => import('luban-low-code').then(m => m.LubanPage))
export default { components: { LubanPageLazy } }
</script>

<style lang="scss" scoped>
.version-history {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;

  &__item {
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid transparent;
    &:hover { background: #f5f7fa; }
    &.is-active {
      border-color: #409eff;
      background: #ecf5ff;
    }
  }

  &__item-head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__summary {
    font-size: 13px;
    color: #303133;
  }

  &__by {
    font-size: 11px;
    color: #909399;
    margin-top: 2px;
  }

  &__preview {
    border-top: 1px solid #ebeef5;
    padding-top: 12px;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  &__preview-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #303133;
  }

  &__preview-canvas {
    flex: 1;
    overflow: auto;
    border: 1px solid #ebeef5;
    border-radius: 6px;
    padding: 12px;
    background: #fff;
  }

  &__preview-html {
    pointer-events: none;
  }
}
</style>

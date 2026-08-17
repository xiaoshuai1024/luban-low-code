<script setup lang="ts">
/**
 * SiteForm.vue — 开通向导 Step2 站点表单（signup-billing-onboarding §4.2.2/§9.5）。
 *
 * props {modelValue:{name,slug}, submitting?}；
 *  - 站点名变化 → 未手动改过 slug 时自动生成建议值（拉丁字符 slugify，纯中文回退随机 site-xxxx）；
 *  - slug 输入防抖 500ms 调 GET /api/sites/slug-check → 绿「可用」/红「已被占用」/转圈「校验中」；
 *  - expose validate()/setSlugError()：向导「创建站点」按钮整单校验；409 SLUG_TAKEN 回写内联错误。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElForm, ElFormItem, ElIcon, ElInput } from 'element-plus'
import { CircleCheckFilled, CircleCloseFilled, Loading } from '@element-plus/icons-vue'
import { checkSlug } from '@/api/site'
import { extractApiError } from '@/api/request'

export interface SiteFormValue {
  name: string
  slug: string
}

const props = defineProps<{
  modelValue: SiteFormValue
  submitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: SiteFormValue): void
}>()

const SLUG_RE = /^[a-z0-9-]{3,48}$/

const nameError = ref('')
const slugError = ref('')
/** slug 校验状态机（§9.5）：idle → checking → available | taken */
const slugState = ref<'idle' | 'checking' | 'available' | 'taken'>('idle')
/** checkSlug 网络/服务端异常时不阻塞提交（服务端 createSite 兜底 409） */
let checkFailed = false
let slugTouched = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const nameValue = computed<string>({
  get: () => props.modelValue.name,
  set: (v) => {
    nameError.value = ''
    emit('update:modelValue', { ...props.modelValue, name: v })
  },
})

const slugValue = computed<string>({
  get: () => props.modelValue.slug,
  set: (v) => {
    slugTouched = true
    slugError.value = ''
    emit('update:modelValue', { ...props.modelValue, slug: v })
  },
})

/** 建议值：拉丁字符 slugify；无有效字符（如纯中文，无拼音库）回退随机 site-xxxx */
function suggestSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  if (base.replace(/-/g, '').length >= 3) return base.slice(0, 48)
  return `site-${Math.random().toString(36).slice(2, 6)}`
}

// 站点名变化 → 自动生成 slug 建议值（可改；手动改过则不再覆盖）
watch(
  () => props.modelValue.name,
  (name) => {
    if (slugTouched || !name) return
    emit('update:modelValue', { ...props.modelValue, slug: suggestSlug(name) })
  },
)

// slug 变化 → 防抖 500ms 预检
watch(
  () => props.modelValue.slug,
  (slug) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    slugError.value = ''
    checkFailed = false
    if (!slug || !SLUG_RE.test(slug)) {
      slugState.value = 'idle'
      return
    }
    slugState.value = 'checking'
    debounceTimer = setTimeout(async () => {
      try {
        const { data } = await checkSlug(slug)
        slugState.value = data.available ? 'available' : 'taken'
      } catch (e) {
        const api = extractApiError(e)
        if (api.code === 'SLUG_TAKEN') {
          slugState.value = 'taken'
        } else {
          // 预检失败不阻塞（提交时服务端兜底校验）
          slugState.value = 'idle'
          checkFailed = true
        }
      }
    }, 500)
  },
)

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})

/** 整单校验（向导「创建站点」前置）：名称 1-32 / slug 格式 / 未被占用 */
function validate(): boolean {
  let ok = true
  const name = props.modelValue.name?.trim() ?? ''
  if (!name) {
    nameError.value = '请输入站点名称'
    ok = false
  } else if (name.length > 32) {
    nameError.value = '站点名称不能超过 32 个字符'
    ok = false
  } else {
    nameError.value = ''
  }

  const slug = props.modelValue.slug ?? ''
  if (!slug || !SLUG_RE.test(slug)) {
    slugError.value = '站点地址需为 3-48 位小写字母、数字或短横线'
    ok = false
  } else if (slugState.value === 'taken') {
    slugError.value = '该站点地址已被占用，请更换'
    ok = false
  } else if (slugState.value === 'checking') {
    slugError.value = '站点地址校验中，请稍候'
    ok = false
  } else if (slugState.value !== 'available' && !checkFailed) {
    slugError.value = '请等待站点地址校验完成'
    ok = false
  } else {
    slugError.value = ''
  }
  return ok
}

/** 向导捕获 createSite 409 SLUG_TAKEN 后回写内联错误 */
function setSlugError(message: string): void {
  slugState.value = 'taken'
  slugError.value = message
}

defineExpose({ validate, setSlugError })
</script>

<template>
  <ElForm :model="modelValue" label-position="top" class="site-form">
    <ElFormItem label="站点名称" :error="nameError">
      <ElInput
        v-model="nameValue"
        placeholder="1-32 个字符，如「我的品牌官网」"
        size="large"
        maxlength="32"
        data-testid="site-name"
      />
    </ElFormItem>
    <ElFormItem label="站点地址" :error="slugError">
      <ElInput
        v-model="slugValue"
        placeholder="3-48 位小写字母、数字或短横线"
        size="large"
        data-testid="site-slug"
      >
        <template #prepend>/</template>
        <template #suffix>
          <span v-if="slugState === 'checking'" class="site-form__status is-checking">
            <ElIcon class="is-loading"><Loading /></ElIcon>
          </span>
          <ElIcon v-else-if="slugState === 'available'" class="site-form__status is-ok">
            <CircleCheckFilled />
          </ElIcon>
          <ElIcon v-else-if="slugState === 'taken'" class="site-form__status is-bad">
            <CircleCloseFilled />
          </ElIcon>
        </template>
      </ElInput>
      <div v-if="slugState === 'checking'" class="site-form__hint">正在检查地址是否可用…</div>
      <div v-else-if="slugState === 'available'" class="site-form__hint is-ok">该地址可用</div>
      <div v-else-if="slugState === 'taken'" class="site-form__hint is-bad">该地址已被占用</div>
    </ElFormItem>
  </ElForm>
</template>

<style lang="scss" scoped>
.site-form__status {
  &.is-ok {
    color: #67c23a;
  }

  &.is-bad {
    color: #f56c6c;
  }
}

.site-form__hint {
  width: 100%;
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
  line-height: 1.4;

  &.is-ok {
    color: #67c23a;
  }

  &.is-bad {
    color: #f56c6c;
  }
}
</style>

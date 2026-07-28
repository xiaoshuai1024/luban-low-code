<script setup lang="ts">
/**
 * DesignUploader.vue — 设计稿图片上传（plan P2-T4）。
 *
 * 支持拖拽 / 粘贴 / 点击选择，客户端预检（类型/大小白名单 jpg/png/webp ≤10MB），
 * 上传成功后 emit('uploaded', {file, preview})；上传进度经 emit('progress')。
 *
 * 预检非法 → ElMessage 提示，不发起请求（与 AI 服务 400 INVALID_IMAGE 对齐）。
 */
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'

interface Props {
  /** 最大字节数（默认 10MB，与 AI 服务 design_image_max_bytes 对齐）。 */
  maxBytes?: number
  /** 允许的 MIME 类型。 */
  allowedTypes?: string[]
  disabled?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  maxBytes: 10 * 1024 * 1024,
  allowedTypes: () => ['image/jpeg', 'image/png', 'image/webp'],
  disabled: false,
})

const emit = defineEmits<{
  (e: 'select', file: File): void
}>()

const dragOver = ref(false)
const previewUrl = ref<string | null>(null)
const fileName = ref<string | null>(null)

const inputAccept = computed(() => props.allowedTypes.join(','))

function validate(file: File): string | null {
  if (!props.allowedTypes.includes(file.type)) {
    return `不支持的图片类型：${file.type || '未知'}（仅支持 ${props.allowedTypes.map((t) => t.replace('image/', '')).join('/')}）`
  }
  if (file.size > props.maxBytes) {
    const mb = (file.size / 1024 / 1024).toFixed(1)
    const maxMb = (props.maxBytes / 1024 / 1024).toFixed(0)
    return `图片过大：${mb}MB（上限 ${maxMb}MB）`
  }
  return null
}

function handleFile(file: File) {
  const err = validate(file)
  if (err) {
    ElMessage.warning(err)
    return
  }
  // 生成本地预览 URL
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = URL.createObjectURL(file)
  fileName.value = file.name
  emit('select', file)
}

function onDrop(e: DragEvent) {
  if (props.disabled) return
  dragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) handleFile(file)
}

function onDragOver() {
  if (!props.disabled) dragOver.value = true
}

function onDragLeave() {
  dragOver.value = false
}

function onPaste(e: ClipboardEvent) {
  if (props.disabled) return
  const file = e.clipboardData?.files?.[0]
  if (file) handleFile(file)
}

function onInputChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) handleFile(file)
  target.value = '' // 允许重复选同一文件
}

function clear() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = null
  fileName.value = null
}

defineExpose({ clear })
</script>

<template>
  <div
    class="design-uploader"
    :class="{ 'design-uploader--drag': dragOver, 'design-uploader--disabled': disabled }"
    @drop.prevent="onDrop"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @paste="onPaste"
    tabindex="0"
  >
    <div v-if="previewUrl" class="design-uploader__preview">
      <img :src="previewUrl" :alt="fileName || '设计稿'" class="design-uploader__img" />
      <div class="design-uploader__name">{{ fileName }}</div>
      <button v-if="!disabled" class="design-uploader__clear" @click="clear">✕ 清除</button>
    </div>
    <div v-else class="design-uploader__empty">
      <div class="design-uploader__hint">📁 拖入图片 / 粘贴 / 点击选择</div>
      <div class="design-uploader__sub">支持 jpg/png/webp，≤{{ (maxBytes / 1024 / 1024).toFixed(0) }}MB</div>
      <input
        type="file"
        :accept="inputAccept"
        class="design-uploader__input"
        :disabled="disabled"
        @change="onInputChange"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.design-uploader {
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s;
  outline: none;

  &:hover,
  &--drag {
    border-color: #409eff;
    background: #ecf5ff;
  }

  &--disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  &__preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  &__img {
    max-width: 100%;
    max-height: 200px;
    object-fit: contain;
    border-radius: 4px;
  }

  &__name {
    font-size: 12px;
    color: #606266;
    word-break: break-all;
  }

  &__clear {
    background: none;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 12px;
    color: #909399;
    cursor: pointer;

    &:hover {
      color: #f56c6c;
      border-color: #f56c6c;
    }
  }

  &__empty {
    padding: 20px 0;
    position: relative;
  }

  &__hint {
    font-size: 14px;
    color: #303133;
    margin-bottom: 4px;
  }

  &__sub {
    font-size: 12px;
    color: #909399;
  }

  &__input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
}
</style>

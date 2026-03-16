import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PageMeta } from '@/api/page'
import type { PageSchema } from '@/types/schema'

export const usePageStore = defineStore('page', () => {
  const pageList = ref<PageMeta[]>([])
  const currentSchema = ref<PageSchema | null>(null)

  function setPageList(list: PageMeta[]) {
    pageList.value = list
  }

  function setCurrentSchema(schema: PageSchema | null) {
    currentSchema.value = schema
  }

  return { pageList, currentSchema, setPageList, setCurrentSchema }
})

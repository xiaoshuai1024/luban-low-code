import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Site } from '@/api/site'

export const useSiteStore = defineStore('site', () => {
  const currentSite = ref<Site | null>(null)
  const siteList = ref<Site[]>([])

  function setCurrentSite(site: Site | null) {
    currentSite.value = site
  }

  function setSiteList(list: Site[]) {
    siteList.value = list
  }

  return { currentSite, siteList, setCurrentSite, setSiteList }
})

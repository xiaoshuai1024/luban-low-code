import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getToken } from '@/api/request'

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(getToken())
  const username = ref<string | null>(null)
  const name = ref<string | null>(null)

  const isLoggedIn = computed(() => !!token.value)

  function setAuth(t: string, user?: { username?: string; name?: string }) {
    token.value = t
    username.value = user?.username ?? null
    name.value = user?.name ?? null
  }

  function clearAuth() {
    token.value = null
    username.value = null
    name.value = null
  }

  return { token, username, name, isLoggedIn, setAuth, clearAuth }
})

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getToken } from '@/api/request'

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(getToken())
  const username = ref<string | null>(null)
  const name = ref<string | null>(null)
  const role = ref<string | null>(null)

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => role.value === 'admin')

  function setAuth(t: string, user?: { username?: string; name?: string; role?: string }) {
    token.value = t
    username.value = user?.username ?? null
    name.value = user?.name ?? null
    role.value = user?.role ?? null
  }

  function clearAuth() {
    token.value = null
    username.value = null
    name.value = null
    role.value = null
  }

  return { token, username, name, role, isLoggedIn, isAdmin, setAuth, clearAuth }
})

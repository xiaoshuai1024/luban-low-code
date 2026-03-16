import './styles/index.scss'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
import { useUserStore } from './stores'
import { getCurrentUser } from './api/auth'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
app.use(ElementPlus)

// 刷新时如果有 token，则尝试拉取当前用户信息
router.isReady().then(async () => {
  const userStore = useUserStore(pinia)
  if (userStore.token) {
    try {
      const { data } = await getCurrentUser()
      userStore.setAuth(userStore.token, data)
    } catch {
      userStore.clearAuth()
    }
  }
  app.mount('#app')
})

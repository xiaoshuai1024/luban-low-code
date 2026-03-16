<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores'
import { logout } from '@/api/auth'
import {
  ElContainer,
  ElAside,
  ElHeader,
  ElMain,
  ElMenu,
  ElMenuItem,
  ElSubMenu,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElIcon,
} from 'element-plus'
import {
  DataBoard,
  Collection,
  Document,
  User,
  Setting,
  ArrowRight,
} from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()

const menuItems = [
  { path: '/dashboard', title: '工作台', icon: DataBoard },
  { path: '/sites', title: '站点管理', icon: Collection },
  { path: '/users', title: '用户管理', icon: User },
  { path: '/settings', title: '系统设置', icon: Setting },
]

function handleLogout() {
  logout()
  userStore.clearAuth()
  router.push('/login')
}

function go(path: string) {
  router.push(path)
}
</script>

<template>
  <ElContainer class="default-layout">
    <ElAside width="220px" class="default-layout__aside">
      <div class="default-layout__logo">Luban</div>
      <ElMenu
        :default-active="$route.path"
        router
        class="default-layout__menu"
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409eff"
      >
        <ElMenuItem
          v-for="item in menuItems"
          :key="item.path"
          :index="item.path"
        >
          <ElIcon><component :is="item.icon" /></ElIcon>
          <span>{{ item.title }}</span>
        </ElMenuItem>
      </ElMenu>
    </ElAside>
    <ElContainer direction="vertical">
      <ElHeader class="default-layout__header">
        <span class="default-layout__title">{{ $route.meta.title ?? '管理后台' }}</span>
        <ElDropdown trigger="click" @command="handleLogout">
          <span class="default-layout__user">
            {{ userStore.name || userStore.username || '用户' }}
            <ElIcon><ArrowRight /></ElIcon>
          </span>
          <template #dropdown>
            <ElDropdownMenu command="logout">
              <ElDropdownItem command="logout">退出登录</ElDropdownItem>
            </ElDropdownMenu>
          </template>
        </ElDropdown>
      </ElHeader>
      <ElMain class="default-layout__main">
        <router-view />
      </ElMain>
    </ElContainer>
  </ElContainer>
</template>

<style lang="scss" scoped>
.default-layout {
  height: 100vh;
}

.default-layout__aside {
  background-color: #304156;
}

.default-layout__logo {
  height: 56px;
  line-height: 56px;
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  background-color: #263445;
}

.default-layout__menu {
  border-right: none;
}

.default-layout__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.default-layout__title {
  font-size: 16px;
  color: #303133;
}

.default-layout__user {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: #606266;
  font-size: 14px;
}

.default-layout__main {
  padding: 20px;
  background-color: #f0f2f5;
  overflow: auto;
}
</style>

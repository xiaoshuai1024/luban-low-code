import { createRouter, createWebHistory } from 'vue-router'
import { getToken } from '@/api/request'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/Login.vue'),
      meta: { layout: 'login', public: true },
    },
    {
      path: '/',
      component: () => import('@/layouts/DefaultLayout.vue'),
      meta: { layout: 'default' },
      children: [
        { path: '', redirect: '/dashboard' },
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: () => import('@/views/Dashboard.vue'),
          meta: { title: '工作台' },
        },
        {
          path: 'sites',
          name: 'SiteList',
          component: () => import('@/views/site/SiteList.vue'),
          meta: { title: '站点管理' },
        },
        {
          path: 'sites/:id',
          name: 'SiteDetail',
          component: () => import('@/views/site/SiteDetail.vue'),
          meta: { title: '站点详情' },
        },
        {
          path: 'sites/:siteId/pages',
          name: 'PageList',
          component: () => import('@/views/page/PageList.vue'),
          meta: { title: '页面列表' },
        },
        {
          path: 'sites/:siteId/pages/new',
          name: 'PageNew',
          component: () => import('@/views/page/PageEditor.vue'),
          meta: { title: '新建页面', isNew: true },
        },
        {
          path: 'sites/:siteId/pages/:pageId',
          name: 'PageEditor',
          component: () => import('@/views/page/PageEditor.vue'),
          meta: { title: '页面编辑' },
        },
        {
          path: 'sites/:siteId/leads',
          name: 'LeadList',
          component: () => import('@/views/lead/LeadList.vue'),
          meta: { title: '线索中心' },
        },
        {
          path: 'sites/:siteId/leads/:id',
          name: 'LeadDetail',
          component: () => import('@/views/lead/LeadDetail.vue'),
          meta: { title: '线索详情' },
        },
        {
          path: 'users',
          name: 'UserList',
          component: () => import('@/views/user/UserList.vue'),
          meta: { title: '用户管理' },
        },
        {
          path: 'settings',
          name: 'Settings',
          component: () => import('@/views/settings/Settings.vue'),
          meta: { title: '系统设置' },
        },
      ],
    },
  ],
})

router.beforeEach((to, _from, next) => {
  const token = getToken()
  const isPublic = to.meta.public === true
  if (!isPublic && !token) {
    next({ path: '/login' })
    return
  }
  if (to.path === '/login' && token) {
    next({ path: '/dashboard' })
    return
  }
  next()
})

export default router

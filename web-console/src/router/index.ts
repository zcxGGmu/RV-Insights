import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes: Array<RouteRecordRaw> = [
  { path: '/login', name: 'login', component: () => import('../views/LoginPage.vue'), meta: { requiresAuth: false } },
  {
    path: '/',
    name: 'home',
    component: () => import('../views/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'cases', component: () => import('../views/CaseListPage.vue') },
      { path: 'cases/:id', name: 'case-detail', component: () => import('../views/CaseDetailPage.vue') }
    ]
  }
]

const router = createRouter({
  history: createWebHistory((import.meta as any).env?.BASE_URL || ''),
  routes
})

router.beforeEach((to, _from, next) => {
  const requiresAuth = to.meta?.requiresAuth ?? false
  const isLoggedIn = !!localStorage.getItem('rv_access_token')
  if (requiresAuth && !isLoggedIn) {
    next({ name: 'login' as const })
    return
  }
  if (to.name === 'login' && isLoggedIn) {
    next({ name: 'home' as const })
    return
  }
  next()
})

export default router

<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50">
    <div class="w-full max-w-md bg-white/90 backdrop-blur rounded-2xl shadow-lg p-6">
      <div class="text-center mb-4">
        <div class="text-3xl font-bold">RV-Insights</div>
        <div class="text-sm text-gray-500">Welcome back</div>
      </div>

      <div class="mb-4 border-b">
        <div class="flex space-x-2 justify-center">
          <button class="px-4 py-2" :class="{ 'border-b-2 border-blue-600': activeTab==='login' }" @click="activeTab='login'">Login</button>
          <button class="px-4 py-2" :class="{ 'border-b-2 border-blue-600': activeTab==='register' }" @click="activeTab='register'">Register</button>
        </div>
      </div>

      <div v-if="activeTab==='login'">
        <form @submit.prevent="submitLogin" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Email</label>
            <input v-model="login.email" type="email" required class="mt-1 w-full rounded-md border border-gray-300 p-2" />
            <p v-if="loginError.email" class="text-xs text-red-600 mt-1">{{ loginError.email }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Password</label>
            <input v-model="login.password" type="password" required class="mt-1 w-full rounded-md border border-gray-300 p-2" />
            <p v-if="loginError.password" class="text-xs text-red-600 mt-1">{{ loginError.password }}</p>
          </div>
          <div v-if="error" class="text-sm text-red-600">{{ error }}</div>
          <button type="submit" class="w-full inline-flex items-center justify-center gap-2 bg-blue-600 text-white rounded-md px-4 py-2">
            <span v-if="loading" class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
            <span>{{ loading ? 'Signing in...' : 'Login' }}</span>
          </button>
        </form>
      </div>

      <div v-else>
        <form @submit.prevent="submitRegister" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Username</label>
            <input v-model="register.username" required class="mt-1 w-full rounded-md border border-gray-300 p-2" />
            <p v-if="registerError.username" class="text-xs text-red-600 mt-1">{{ registerError.username }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Email</label>
            <input v-model="register.email" type="email" required class="mt-1 w-full rounded-md border border-gray-300 p-2" />
            <p v-if="registerError.email" class="text-xs text-red-600 mt-1">{{ registerError.email }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Password</label>
            <input v-model="register.password" type="password" required class="mt-1 w-full rounded-md border border-gray-300 p-2" />
            <p v-if="registerError.password" class="text-xs text-red-600 mt-1">{{ registerError.password }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Confirm Password</label>
            <input v-model="register.confirmPassword" type="password" required class="mt-1 w-full rounded-md border border-gray-300 p-2" />
            <p v-if="registerError.confirmPassword" class="text-xs text-red-600 mt-1">{{ registerError.confirmPassword }}</p>
          </div>
          <div v-if="error" class="text-sm text-red-600">{{ error }}</div>
          <button type="submit" class="w-full inline-flex items-center justify-center gap-2 bg-green-600 text-white rounded-md px-4 py-2">
            <span v-if="loading" class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
            <span>{{ loading ? 'Registering...' : 'Register' }}</span>
          </button>
        </form>
      </div>

      <div class="mt-4 text-center text-sm">
        <button class="text-blue-600" @click="toggleLogin">{{ activeTab==='login' ? 'Need an account? Register' : 'Have an account? Login' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const activeTab = ref<'login'|'register'>('login')

const login = ref({ email: '', password: '' })
const loginError = ref<{ email?: string; password?: string }>({})

const register = ref({ username: '', email: '', password: '', confirmPassword: '' })
const registerError = ref<{ username?: string; email?: string; password?: string; confirmPassword?: string }>({})

const loading = ref(false)
const error = ref<string | null>(null)

function toggleLogin() {
  activeTab.value = activeTab.value === 'login' ? 'register' : 'login'
}

async function submitLogin() {
  loginError.value = {}
  error.value = null
  if (!login.value.email) loginError.value.email = 'Email is required'
  if (!login.value.password) loginError.value.password = 'Password is required'
  if (Object.keys(loginError.value).length > 0) return
  loading.value = true
    try {
    await auth.login(login.value.email, login.value.password)
    router.push('/')
  } catch (e: any) {
    error.value = e?.message ?? 'Login failed'
  } finally {
    loading.value = false
  }
}

async function submitRegister() {
  registerError.value = {}
  error.value = null
  if (!register.value.username) registerError.value.username = 'Username is required'
  if (!register.value.email) registerError.value.email = 'Email is required'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(register.value.email)) registerError.value.email = 'Invalid email'
  if (!register.value.password) registerError.value.password = 'Password is required'
  else if (register.value.password.length < 8) registerError.value.password = 'Password must be at least 8 characters'
  if (register.value.password !== register.value.confirmPassword) registerError.value.confirmPassword = 'Passwords do not match'
  if (Object.keys(registerError.value).length > 0) return
  loading.value = true
    try {
    await auth.register(register.value.username, register.value.email, register.value.password)
    router.push('/')
  } catch (e: any) {
    error.value = e?.message ?? 'Registration failed'
  } finally {
    loading.value = false
  }
}
</script>

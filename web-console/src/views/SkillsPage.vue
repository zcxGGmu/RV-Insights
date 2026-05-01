<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Shield, ShieldOff, Trash2, BookOpen } from 'lucide-vue-next'
import { listSkills, blockSkill, deleteSkill } from '@/api/skills'
import type { ExternalSkillItem } from '@/types'
import { showErrorToast } from '@/utils/toast'

const router = useRouter()
const skills = ref<ExternalSkillItem[]>([])
const loading = ref(true)

async function loadSkills() {
  loading.value = true
  try {
    const res = await listSkills()
    if (res.code === 0) skills.value = res.data
  } finally {
    loading.value = false
  }
}

async function toggleBlock(skill: ExternalSkillItem) {
  try {
    const res = await blockSkill(skill.name, !skill.blocked)
    if (res.code === 0) {
      skills.value = skills.value.map(s =>
        s.name === skill.name ? { ...s, blocked: !s.blocked } : s
      )
    }
  } catch (e: any) {
    showErrorToast(e?.response?.data?.detail || '操作失败')
  }
}

async function handleDelete(skill: ExternalSkillItem) {
  if (skill.builtin) return
  if (!confirm(`确定删除技能 "${skill.name}"？`)) return
  try {
    const res = await deleteSkill(skill.name)
    if (res.code === 0) {
      skills.value = skills.value.filter(s => s.name !== skill.name)
    }
  } catch (e: any) {
    showErrorToast(e?.response?.data?.detail || '删除失败')
  }
}

function viewDetail(name: string) {
  router.push(`/skills/${name}`)
}

onMounted(loadSkills)
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-8">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">
        Skills
      </h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        管理技能模块
      </p>
    </div>

    <!-- Loading skeleton -->
    <div
      v-if="loading"
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <div
        v-for="i in 6"
        :key="i"
        class="animate-pulse rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900"
      >
        <div class="mb-3 h-5 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
        <div class="mb-2 h-4 w-full rounded bg-gray-100 dark:bg-gray-800" />
        <div class="h-4 w-1/2 rounded bg-gray-100 dark:bg-gray-800" />
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="skills.length === 0"
      class="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-20 dark:border-gray-600"
    >
      <BookOpen class="mb-3 size-10 text-gray-300 dark:text-gray-600" />
      <p class="text-sm text-gray-500 dark:text-gray-400">暂无技能</p>
    </div>

    <!-- Skill cards grid -->
    <div
      v-else
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <div
        v-for="skill in skills"
        :key="skill.name"
        class="group relative cursor-pointer rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-700"
        @click="viewDetail(skill.name)"
      >
        <!-- Badge -->
        <span
          v-if="skill.builtin"
          class="mb-3 inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
        >
          内置
        </span>
        <span
          v-else
          class="mb-3 inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300"
        >
          自定义
        </span>

        <!-- Name & description -->
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
          {{ skill.name }}
        </h3>
        <p class="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
          {{ skill.description || '暂无描述' }}
        </p>

        <!-- Action buttons -->
        <div
          class="mt-4 flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100"
          @click.stop
        >
          <button
            class="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            :title="skill.blocked ? '取消屏蔽' : '屏蔽'"
            @click="toggleBlock(skill)"
          >
            <ShieldOff v-if="skill.blocked" class="size-4" />
            <Shield v-else class="size-4" />
          </button>
          <button
            class="rounded-lg p-1.5 transition-colors"
            :class="
              skill.builtin
                ? 'cursor-not-allowed text-gray-200 dark:text-gray-700'
                : 'text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400'
            "
            :disabled="skill.builtin"
            title="删除"
            @click="handleDelete(skill)"
          >
            <Trash2 class="size-4" />
          </button>
        </div>

        <!-- Blocked overlay indicator -->
        <div
          v-if="skill.blocked"
          class="absolute right-3 top-3"
        >
          <ShieldOff class="size-4 text-orange-400" />
        </div>
      </div>
    </div>
  </div>
</template>

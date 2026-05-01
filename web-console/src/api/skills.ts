import { apiClient } from './client'

const BASE = '/api/v1/sessions/skills'

export async function listSkills() {
  const res = await apiClient.get(BASE)
  return res.data
}

export async function blockSkill(name: string, blocked: boolean) {
  const res = await apiClient.put(`${BASE}/${name}/block`, { blocked })
  return res.data
}

export async function deleteSkill(name: string) {
  const res = await apiClient.delete(`${BASE}/${name}`)
  return res.data
}

export async function browseSkillFiles(name: string, path = '') {
  const res = await apiClient.get(`${BASE}/${name}/files`, { params: { path } })
  return res.data
}

export async function readSkillFile(name: string, file: string) {
  const res = await apiClient.post(`${BASE}/${name}/read`, { file })
  return res.data
}

export async function saveSkillFromSession(sessionId: string, skillName: string) {
  const res = await apiClient.post(`/api/v1/sessions/${sessionId}/skills/save`, { skill_name: skillName })
  return res.data
}

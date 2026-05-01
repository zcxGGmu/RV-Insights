import { apiClient } from './client'

export async function optimizePrompt(prompt: string, language = 'en') {
  const res = await apiClient.post('/api/v1/science/optimize-prompt', { prompt, language })
  return res.data
}

import api from '@/lib/axios'

export interface IEmailSettings {
  smtp_configured: boolean
  paused: boolean
  active: boolean
}

interface ApiResponse<T> {
  data: T
  message: string
}

export async function getEmailSettings() {
  const { data } = await api.get<ApiResponse<IEmailSettings>>('/api/v1/admin/email-settings')
  return data.data
}

export async function setEmailPaused(paused: boolean) {
  const { data } = await api.put<ApiResponse<{ paused: boolean }>>('/api/v1/admin/email-settings', { paused })
  return data
}

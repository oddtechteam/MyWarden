import api from '@/lib/axios'
import type { ILoginRequest, ITokenResponse, IUser } from '@/types/auth'

export async function login(payload: ILoginRequest) {
  const { data } = await api.post<{ data: ITokenResponse; message: string }>(
    '/api/v1/auth/login',
    payload,
  )
  return data
}

export async function logout() {
  await api.post('/api/v1/auth/logout')
}

export async function refreshToken(token: string) {
  const { data } = await api.post<{ data: ITokenResponse; message: string }>(
    '/api/v1/auth/refresh',
    { refresh_token: token },
  )
  return data
}

export async function getMe() {
  const { data } = await api.get<{ data: IUser; message: string }>('/api/v1/auth/me')
  return data
}

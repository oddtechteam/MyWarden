// TODO: implement in Phase 1 Part 2
import api from '@/lib/axios'
import type { ILoginRequest, ITokenResponse } from '@/types/auth'

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

export async function refreshToken(refreshToken: string) {
  const { data } = await api.post<{ data: ITokenResponse; message: string }>(
    '/api/v1/auth/refresh',
    { refresh_token: refreshToken },
  )
  return data
}

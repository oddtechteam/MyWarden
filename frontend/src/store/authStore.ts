import { create } from 'zustand'
import type { IUser } from '@/types/auth'

interface AuthState {
  user: IUser | null
  accessToken: string | null
  setAuth: (user: IUser, accessToken: string, refreshToken: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: localStorage.getItem('access_token'),
  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)
    set({ user, accessToken })
  },
  clearAuth: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, accessToken: null })
  },
}))

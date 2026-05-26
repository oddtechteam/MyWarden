import { create } from 'zustand'
import type { IUser } from '@/types/auth'

interface AuthState {
  user: IUser | null
  accessToken: string | null
  setAuth: (user: IUser, token: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: localStorage.getItem('access_token'),
  setAuth: (user, token) => {
    localStorage.setItem('access_token', token)
    set({ user, accessToken: token })
  },
  clearAuth: () => {
    localStorage.removeItem('access_token')
    set({ user: null, accessToken: null })
  },
}))

import { create } from 'zustand'
import type { IUser } from '@/types/auth'

interface AuthState {
  user: IUser | null
  accessToken: string | null
  isBootstrapping: boolean
  setAuth: (user: IUser, accessToken: string, refreshToken: string) => void
  clearAuth: () => void
  bootstrapAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: localStorage.getItem('access_token'),
  isBootstrapping: true,

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

  bootstrapAuth: async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      set({ isBootstrapping: false })
      return
    }
    try {
      const { getMe } = await import('@/api/auth')
      const { data: user } = await getMe()
      set({ user, isBootstrapping: false })
    } catch {
      // Token invalid/expired and refresh also failed — axios interceptor
      // already redirects to /login; clear stale tokens from store too.
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      set({ user: null, accessToken: null, isBootstrapping: false })
    }
  },
}))

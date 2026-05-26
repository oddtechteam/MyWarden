import axios, { type AxiosRequestConfig } from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let isRefreshing = false
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)))
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    const storedRefresh = localStorage.getItem('refresh_token')
    if (!storedRefresh) {
      localStorage.removeItem('access_token')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token) => {
            if (original.headers) original.headers['Authorization'] = `Bearer ${token}`
            resolve(api(original))
          },
          reject,
        })
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/v1/auth/refresh`,
        { refresh_token: storedRefresh },
      )
      const newAccess: string = data.data.access_token
      const newRefresh: string = data.data.refresh_token
      localStorage.setItem('access_token', newAccess)
      localStorage.setItem('refresh_token', newRefresh)
      processQueue(null, newAccess)
      if (original.headers) original.headers['Authorization'] = `Bearer ${newAccess}`
      return api(original)
    } catch (refreshError) {
      processQueue(refreshError, null)
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      window.location.href = '/login'
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)

export default api

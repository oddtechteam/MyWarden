import api from '@/lib/axios'
import type {
  IDepartment,
  IEmployee,
  IEmployeeCreate,
  IEmployeeListResponse,
  IEmployeeUpdate,
} from '@/types/employee'

interface ApiResponse<T> {
  data: T
  message: string
}

export async function listEmployees(params?: {
  page?: number
  limit?: number
  search?: string
  department_id?: string
  employee_type?: string
  is_active?: boolean
}) {
  const { data } = await api.get<ApiResponse<IEmployeeListResponse>>('/api/v1/employees/', { params })
  return data.data
}

export async function getEmployee(id: string) {
  const { data } = await api.get<ApiResponse<IEmployee>>(`/api/v1/employees/${id}`)
  return data.data
}

export async function createEmployee(payload: IEmployeeCreate) {
  const { data } = await api.post<ApiResponse<IEmployee>>('/api/v1/employees/', payload)
  return data.data
}

export async function updateEmployee(id: string, payload: IEmployeeUpdate) {
  const { data } = await api.put<ApiResponse<IEmployee>>(`/api/v1/employees/${id}`, payload)
  return data.data
}

export async function deactivateEmployee(id: string) {
  await api.delete(`/api/v1/employees/${id}`)
}

export async function enrollFace(employeeId: string, frames: Blob[]): Promise<void> {
  const form = new FormData()
  frames.forEach((blob, i) => form.append('files', blob, `frame_${String(i).padStart(2, '0')}.jpg`))
  await api.post(`/api/v1/employees/${employeeId}/enroll-face`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  })
}

export async function getMyProfile() {
  const { data } = await api.get<ApiResponse<IEmployee>>('/api/v1/employees/me')
  return data.data
}

export async function updateMyProfile(payload: { full_name?: string; phone?: string }) {
  const { data } = await api.put<ApiResponse<IEmployee>>('/api/v1/employees/me', payload)
  return data.data
}

export async function listDepartments() {
  const { data } = await api.get<ApiResponse<IDepartment[]>>('/api/v1/departments/')
  return data.data
}

export async function createDepartment(payload: { name: string; description?: string }) {
  const { data } = await api.post<ApiResponse<IDepartment>>('/api/v1/departments/', payload)
  return data.data
}

export async function updateDepartment(id: string, payload: { name?: string; description?: string }) {
  const { data } = await api.put<ApiResponse<IDepartment>>(`/api/v1/departments/${id}`, payload)
  return data.data
}

export async function deactivateDepartment(id: string) {
  await api.delete(`/api/v1/departments/${id}`)
}

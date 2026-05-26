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

export async function listDepartments() {
  const { data } = await api.get<ApiResponse<IDepartment[]>>('/api/v1/departments/')
  return data.data
}

export async function createDepartment(payload: { name: string; description?: string }) {
  const { data } = await api.post<ApiResponse<IDepartment>>('/api/v1/departments/', payload)
  return data.data
}

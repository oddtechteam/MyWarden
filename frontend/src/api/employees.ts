// TODO: implement in Phase 1 Part 3
import api from '@/lib/axios'
import type { IEmployee, IEmployeeCreate } from '@/types/employee'

export async function getEmployees(page = 1, limit = 20) {
  const { data } = await api.get<{ data: IEmployee[]; message: string }>(
    '/api/v1/employees',
    { params: { page, limit } },
  )
  return data
}

export async function createEmployee(payload: IEmployeeCreate) {
  const { data } = await api.post<{ data: IEmployee; message: string }>(
    '/api/v1/employees',
    payload,
  )
  return data
}

export async function getEmployee(id: string) {
  const { data } = await api.get<{ data: IEmployee; message: string }>(
    `/api/v1/employees/${id}`,
  )
  return data
}

export async function deactivateEmployee(id: string) {
  const { data } = await api.delete<{ message: string }>(
    `/api/v1/employees/${id}`,
  )
  return data
}

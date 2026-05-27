import api from '@/lib/axios'
import type { ILeaveBalance, ILeaveListResponse, ILeaveRequest, ILeaveType } from '@/types/leave'

interface ApiResponse<T> {
  data: T
  message: string
}

// ─── Leave types ─────────────────────────────────────────────────────────────

export async function listLeaveTypes(includeInactive = false) {
  const { data } = await api.get<ApiResponse<ILeaveType[]>>('/api/v1/leave/types', {
    params: includeInactive ? { include_inactive: true } : {},
  })
  return data.data
}

export async function createLeaveType(payload: {
  name: string
  code: string
  days_per_year: number
  is_paid?: boolean
}) {
  const { data } = await api.post<ApiResponse<ILeaveType>>('/api/v1/leave/types', payload)
  return data.data
}

export async function updateLeaveType(
  id: string,
  payload: { name?: string; days_per_year?: number; is_paid?: boolean; is_active?: boolean },
) {
  const { data } = await api.put<ApiResponse<ILeaveType>>(`/api/v1/leave/types/${id}`, payload)
  return data.data
}

// ─── Leave balances ───────────────────────────────────────────────────────────

export async function getMyBalances(year?: number) {
  const { data } = await api.get<ApiResponse<ILeaveBalance[]>>('/api/v1/leave/balances/me', {
    params: year ? { year } : {},
  })
  return data.data
}

// ─── Leave requests ───────────────────────────────────────────────────────────

export async function applyLeave(payload: {
  leave_type_id: string
  start_date: string
  end_date: string
  reason?: string
}) {
  const { data } = await api.post<ApiResponse<ILeaveRequest>>('/api/v1/leave/apply', payload)
  return data.data
}

export async function listLeaveRequests(params?: {
  page?: number
  limit?: number
  status?: string
  employee_id?: string
  date_from?: string
  date_to?: string
}) {
  const { data } = await api.get<ApiResponse<ILeaveListResponse>>('/api/v1/leave/', { params })
  return data.data
}

export async function approveLeave(id: string, review_note?: string) {
  const { data } = await api.put<ApiResponse<ILeaveRequest>>(`/api/v1/leave/${id}/approve`, {
    review_note: review_note ?? null,
  })
  return data.data
}

export async function rejectLeave(id: string, review_note?: string) {
  const { data } = await api.put<ApiResponse<ILeaveRequest>>(`/api/v1/leave/${id}/reject`, {
    review_note: review_note ?? null,
  })
  return data.data
}

export async function cancelLeave(id: string) {
  const { data } = await api.put<ApiResponse<ILeaveRequest>>(`/api/v1/leave/${id}/cancel`)
  return data.data
}

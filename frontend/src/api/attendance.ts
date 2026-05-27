import api from '@/lib/axios'
import type {
  IAttendanceListResponse,
  IAttendanceLog,
  ICheckinResponse,
  IShift,
} from '@/types/attendance'

interface ApiResponse<T> {
  data: T
  message: string
}

// ─── Kiosk (public endpoints — JWT attached but ignored by server) ──────────

export async function submitCheckin(blob: Blob): Promise<ICheckinResponse> {
  const form = new FormData()
  form.append('file', blob, 'frame.jpg')
  const { data } = await api.post<ApiResponse<ICheckinResponse>>(
    '/api/v1/attendance-logs/checkin',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return data.data
}

export async function submitCheckout(blob: Blob): Promise<ICheckinResponse> {
  const form = new FormData()
  form.append('file', blob, 'frame.jpg')
  const { data } = await api.post<ApiResponse<ICheckinResponse>>(
    '/api/v1/attendance-logs/checkout',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return data.data
}

// ─── Attendance logs ────────────────────────────────────────────────────────

export async function listAttendanceLogs(params?: {
  page?: number
  limit?: number
  employee_id?: string
  department_id?: string
  date_from?: string
  date_to?: string
  status?: string
}) {
  const { data } = await api.get<ApiResponse<IAttendanceListResponse>>(
    '/api/v1/attendance-logs/',
    { params },
  )
  return data.data
}

export async function getMyAttendance(params?: {
  page?: number
  limit?: number
  date_from?: string
  date_to?: string
}) {
  const { data } = await api.get<ApiResponse<IAttendanceListResponse>>(
    '/api/v1/attendance-logs/me',
    { params },
  )
  return data.data
}

export async function patchAttendanceLog(
  logId: string,
  payload: Partial<{
    status: string
    check_in_at: string
    check_out_at: string
    shift_id: string
    notes: string
  }>,
) {
  const { data } = await api.patch<ApiResponse<IAttendanceLog>>(
    `/api/v1/attendance-logs/${logId}`,
    payload,
  )
  return data.data
}

// ─── Shifts ─────────────────────────────────────────────────────────────────

export async function listShifts() {
  const { data } = await api.get<ApiResponse<IShift[]>>('/api/v1/shifts/')
  return data.data
}

export async function createShift(payload: {
  name: string
  start_time: string
  end_time: string
  grace_minutes?: number
}) {
  const { data } = await api.post<ApiResponse<IShift>>('/api/v1/shifts/', payload)
  return data.data
}

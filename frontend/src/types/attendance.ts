export type AttendanceStatus = 'present' | 'late' | 'absent' | 'half_day'
export type CheckInMethod = 'face' | 'otp' | 'manual'

export interface IEmployeeBrief {
  id: string
  full_name: string | null
  email: string
}

export interface IShift {
  id: string
  name: string
  start_time: string   // "HH:MM:SS"
  end_time: string
  grace_minutes: number
  is_active: boolean
}

export interface IAttendanceLog {
  id: string
  employee_id: string
  employee: IEmployeeBrief | null
  shift_id: string | null
  work_date: string          // "YYYY-MM-DD"
  check_in_at: string | null // ISO UTC datetime
  check_out_at: string | null
  check_in_method: CheckInMethod | null
  check_out_method: CheckInMethod | null
  check_in_photo_key: string | null
  status: AttendanceStatus
  notes: string | null
  created_at: string
}

export interface ICheckinResponse {
  log_id: string
  employee_id: string
  employee_name: string | null
  work_date: string
  check_in_at: string | null
  check_out_at: string | null
  status: AttendanceStatus
  shift_name: string | null
}

export interface IAttendanceListResponse {
  items: IAttendanceLog[]
  total: number
  page: number
  limit: number
  pages: number
}

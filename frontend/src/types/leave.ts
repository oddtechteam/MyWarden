export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface ILeaveType {
  id: string
  name: string
  code: string
  days_per_year: number
  is_paid: boolean
  is_active: boolean
}

export interface ILeaveEmployeeBrief {
  id: string
  full_name: string | null
  email: string
}

export interface ILeaveRequest {
  id: string
  employee_id: string
  employee: ILeaveEmployeeBrief | null
  leave_type_id: string
  leave_type: ILeaveType
  start_date: string       // "YYYY-MM-DD"
  end_date: string
  days_requested: string   // Decimal serialised as string
  reason: string | null
  status: LeaveStatus
  reviewed_by_id: string | null
  reviewed_at: string | null
  review_note: string | null
  created_at: string
}

export interface ILeaveBalance {
  id: string
  employee_id: string
  leave_type_id: string
  leave_type: ILeaveType
  year: number
  allocated: string   // Decimal as string
  used: string
  remaining: string
}

export interface ILeaveListResponse {
  items: ILeaveRequest[]
  total: number
  page: number
  limit: number
  pages: number
}

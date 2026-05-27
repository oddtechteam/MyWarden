export interface IAttendanceEmployee {
  id: string
  full_name: string
  email: string
  job_title: string
  employee_type: string
  days_present: number
  days_late: number
  days_half: number
  days_absent: number
  attendance_pct: number
}

export interface IAttendanceReport {
  period: { year: number; month: number; month_name: string }
  working_days: number
  total_employees: number
  summary: { present: number; late: number; half_day: number; absent: number }
  employees: IAttendanceEmployee[]
}

export interface ILeaveByType {
  leave_type: string
  code: string
  is_paid: boolean
  request_count: number
  total_days: number
}

export interface ILeaveTopTaker {
  id: string
  full_name: string
  email: string
  job_title: string
  request_count: number
  total_days: number
}

export interface ILeaveReport {
  year: number
  total_approved_requests: number
  total_days_taken: number
  by_type: ILeaveByType[]
  top_takers: ILeaveTopTaker[]
}

export interface IPayrollMonth {
  period_month: number
  month_name: string
  revision: number
  status: string
  employee_count: number
  total_gross: number
  total_deductions: number
  total_net: number
}

export interface IPayrollReport {
  year: number
  total_gross: number
  total_net: number
  total_deductions: number
  months: IPayrollMonth[]
}

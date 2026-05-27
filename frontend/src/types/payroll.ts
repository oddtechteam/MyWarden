export type PayrollStatus = 'draft' | 'processed' | 'approved' | 'paid'
export type DeductionType = 'percentage' | 'fixed'
export type AppliesTo = 'all' | 'FULL_TIME' | 'HOURLY' | 'CONTRACT'

export interface IPayrollRun {
  id: string
  period_year: number
  period_month: number
  revision: number
  status: PayrollStatus
  notes: string | null
  created_by_id: string | null
  processed_at: string | null
  approved_by_id: string | null
  approved_at: string | null
  paid_at: string | null
  created_at: string
}

export interface IPayrollEmployeeBrief {
  id: string
  full_name: string | null
  email: string
  job_title: string | null
}

export interface IPayrollEntry {
  id: string
  payroll_run_id: string
  employee_id: string | null
  employee: IPayrollEmployeeBrief | null
  employee_type: string
  period_year: number
  period_month: number
  working_days: string
  days_present: string
  gross_salary: string
  total_deductions: string
  net_salary: string
  deduction_breakdown: Record<string, number>
  payslip_key: string | null
  created_at: string
}

export interface IPayrollRunDetail extends IPayrollRun {
  entries: IPayrollEntry[]
  entry_count: number
  total_gross: string
  total_net: string
}

export interface IDeductionRule {
  id: string
  name: string
  code: string
  description: string | null
  type: DeductionType
  value: string
  applies_to: AppliesTo
  is_statutory: boolean
  is_active: boolean
}

export interface IPayrollRunListResponse {
  items: IPayrollRun[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface IPayrollEntryListResponse {
  items: IPayrollEntry[]
  total: number
  page: number
  limit: number
  pages: number
}

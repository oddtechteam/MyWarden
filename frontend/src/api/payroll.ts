import api from '@/lib/axios'
import type {
  IDeductionRule,
  IPayrollEntry,
  IPayrollEntryListResponse,
  IPayrollRun,
  IPayrollRunDetail,
  IPayrollRunListResponse,
} from '@/types/payroll'

interface ApiResponse<T> {
  data: T
  message: string
}

// ─── Payroll runs ─────────────────────────────────────────────────────────────

export async function listPayrollRuns(page = 1, limit = 20) {
  const { data } = await api.get<IPayrollRunListResponse>('/api/v1/payroll-runs', { params: { page, limit } })
  return data
}

export async function createPayrollRun(payload: {
  period_year: number
  period_month: number
  notes?: string
}) {
  const { data } = await api.post<ApiResponse<IPayrollRun>>('/api/v1/payroll-runs', payload)
  return data.data
}

export async function getPayrollRun(id: string) {
  const { data } = await api.get<ApiResponse<IPayrollRunDetail>>(`/api/v1/payroll-runs/${id}`)
  return data.data
}

export async function processRun(id: string) {
  const { data } = await api.post<ApiResponse<IPayrollRun>>(`/api/v1/payroll-runs/${id}/process`)
  return data.data
}

export async function approveRun(id: string) {
  const { data } = await api.put<ApiResponse<IPayrollRun>>(`/api/v1/payroll-runs/${id}/approve`)
  return data.data
}

export async function markPaid(id: string) {
  const { data } = await api.put<ApiResponse<IPayrollRun>>(`/api/v1/payroll-runs/${id}/mark-paid`)
  return data.data
}

export async function listRunEntries(runId: string, page = 1, limit = 50) {
  const { data } = await api.get<IPayrollEntryListResponse>(`/api/v1/payroll-runs/${runId}/entries`, {
    params: { page, limit },
  })
  return data
}

// ─── My payslips (employee self-service) ─────────────────────────────────────

export async function myPayrollEntries(page = 1, limit = 20) {
  const { data } = await api.get<IPayrollEntryListResponse>('/api/v1/payroll-runs/entries/me', {
    params: { page, limit },
  })
  return data
}

// ─── Payslip PDF download ─────────────────────────────────────────────────────

export async function downloadPayslip(runId: string, entryId: string, filename: string) {
  const response = await api.get(`/api/v1/payroll-runs/${runId}/entries/${entryId}/payslip`, {
    responseType: 'blob',
  })
  const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Deduction rules ──────────────────────────────────────────────────────────

export async function listDeductionRules(includeInactive = false) {
  const { data } = await api.get<ApiResponse<IDeductionRule[]>>('/api/v1/deduction-rules', {
    params: includeInactive ? { include_inactive: true } : {},
  })
  return data.data
}

export async function createDeductionRule(payload: {
  name: string
  code: string
  description?: string
  type: string
  value: number
  applies_to: string
  is_statutory: boolean
}) {
  const { data } = await api.post<ApiResponse<IDeductionRule>>('/api/v1/deduction-rules', payload)
  return data.data
}

export async function updateDeductionRule(
  id: string,
  payload: {
    name?: string
    description?: string
    value?: number
    applies_to?: string
    is_active?: boolean
  },
) {
  const { data } = await api.put<ApiResponse<IDeductionRule>>(`/api/v1/deduction-rules/${id}`, payload)
  return data.data
}

export async function deactivateDeductionRule(id: string) {
  await api.delete(`/api/v1/deduction-rules/${id}`)
}

// Re-export types for convenience
export type { IPayrollEntry, IPayrollRun, IPayrollRunDetail, IDeductionRule }

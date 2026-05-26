// TODO: implement in Phase 3
import api from '@/lib/axios'

export async function getPayrollRuns(page = 1, limit = 20) {
  const { data } = await api.get('/api/v1/payroll-runs', { params: { page, limit } })
  return data
}

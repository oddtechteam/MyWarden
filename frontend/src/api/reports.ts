import api from '@/lib/axios'
import type { IAttendanceReport, ILeaveReport, IPayrollReport } from '@/types/reports'

interface ApiResponse<T> {
  data: T
  message: string
}

export async function getAttendanceReport(year: number, month: number) {
  const { data } = await api.get<ApiResponse<IAttendanceReport>>('/api/v1/reports/attendance', {
    params: { year, month },
  })
  return data.data
}

export async function getLeaveReport(year: number) {
  const { data } = await api.get<ApiResponse<ILeaveReport>>('/api/v1/reports/leave', {
    params: { year },
  })
  return data.data
}

export async function getPayrollReport(year: number) {
  const { data } = await api.get<ApiResponse<IPayrollReport>>('/api/v1/reports/payroll', {
    params: { year },
  })
  return data.data
}

export function downloadReportCSV(
  type: 'attendance' | 'leave' | 'payroll',
  params: Record<string, number>,
) {
  const query = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), format: 'csv' })
  const token = localStorage.getItem('access_token')
  // Open in same tab — browser will download the CSV file
  const url = `${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/v1/reports/${type}?${query}`
  const a = document.createElement('a')
  a.href = url
  // Attach auth header by fetching as blob instead
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.blob())
    .then((blob) => {
      const burl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = burl
      link.download = `${type}_report.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(burl)
    })
}

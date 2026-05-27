import { useState, useEffect, useCallback } from 'react'
import Layout from '@/components/app/Layout'
import { useAuthStore } from '@/store/authStore'
import { getAttendanceReport, getLeaveReport, getPayrollReport, downloadReportCSV } from '@/api/reports'
import type { IAttendanceReport, ILeaveReport, IPayrollReport } from '@/types/reports'

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const NOW = new Date()

// ─── Shared utilities ─────────────────────────────────────────────────────────

function fmtCurrency(val: number) {
  return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function StatCard({ label, value, sub, color = 'default' }: {
  label: string
  value: string | number
  sub?: string
  color?: 'default' | 'emerald' | 'rose' | 'amber' | 'blue'
}) {
  const val = {
    default: 'text-slate-100',
    emerald: 'text-emerald-400',
    rose:    'text-rose-400',
    amber:   'text-amber-400',
    blue:    'text-blue-400',
  }[color]

  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-800/20 px-5 py-4">
      <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${val}`}>{value}</p>
      {sub && <p className="text-slate-600 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-600">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 mb-3 opacity-40">
        <path d="M9 17H5a2 2 0 0 0-2 2v0a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v0a2 2 0 0 0-2-2h-4" />
        <rect x="9" y="3" width="6" height="14" rx="1" />
      </svg>
      <p className="text-sm">{message}</p>
    </div>
  )
}

function CsvButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700/50 text-slate-400 hover:text-slate-200 hover:border-slate-600 text-xs font-medium transition-all"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Export CSV
    </button>
  )
}

// ─── Attendance tab ───────────────────────────────────────────────────────────

function AttendanceTab() {
  const [year,  setYear]  = useState(NOW.getFullYear())
  const [month, setMonth] = useState(NOW.getMonth() + 1)
  const [data,  setData]  = useState<IAttendanceReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true)
    setErr('')
    try {
      setData(await getAttendanceReport(y, m))
    } catch {
      setErr('Failed to load attendance report.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(year, month) }, [load, year, month])

  function handleYearMonth(y: number, m: number) {
    setYear(y); setMonth(m)
  }

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={year}
          onChange={(e) => handleYearMonth(Number(e.target.value), month)}
          className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-indigo-500/50"
        >
          {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={month}
          onChange={(e) => handleYearMonth(year, Number(e.target.value))}
          className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-indigo-500/50"
        >
          {MONTH_NAMES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <div className="ml-auto">
          <CsvButton onClick={() => downloadReportCSV('attendance', { year, month })} />
        </div>
      </div>

      {err && <p className="text-rose-400 text-sm">{err}</p>}

      {loading ? (
        <div className="p-12 text-center text-slate-600 text-sm">Loading…</div>
      ) : data ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Working Days"    value={data.working_days} />
            <StatCard label="Total Employees" value={data.total_employees} />
            <StatCard label="Present Days"    value={data.summary.present} color="emerald" />
            <StatCard label="Absent Days"     value={data.summary.absent}  color="rose" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Late Arrivals" value={data.summary.late}     color="amber" />
            <StatCard label="Half Days"     value={data.summary.half_day} color="blue" />
          </div>

          {/* Employee breakdown table */}
          <div className="rounded-2xl border border-slate-800/60 bg-slate-800/10 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800/40 flex items-center justify-between">
              <h3 className="text-slate-200 font-semibold text-sm">
                {data.period.month_name} {data.period.year} — Employee Breakdown
              </h3>
              <span className="text-slate-500 text-xs">{data.total_employees} employees</span>
            </div>
            {data.employees.length === 0 ? (
              <EmptyState message="No employees found." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800/40">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Employee</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Type</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Present</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Late</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Half</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Absent</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Att. %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {data.employees.map((emp) => {
                      const pct = emp.attendance_pct
                      const pctColor = pct >= 90 ? 'text-emerald-400' : pct >= 75 ? 'text-amber-400' : 'text-rose-400'
                      return (
                        <tr key={emp.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="px-5 py-3.5">
                            <p className="text-slate-200 font-medium text-sm">{emp.full_name}</p>
                            <p className="text-slate-500 text-xs">{emp.email}</p>
                          </td>
                          <td className="px-5 py-3.5 hidden md:table-cell">
                            <span className="text-xs text-slate-400 bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700/50">{emp.employee_type}</span>
                          </td>
                          <td className="px-5 py-3.5 text-right text-emerald-400 font-medium tabular-nums text-sm">{emp.days_present}</td>
                          <td className="px-5 py-3.5 text-right text-amber-400 tabular-nums text-sm hidden sm:table-cell">{emp.days_late}</td>
                          <td className="px-5 py-3.5 text-right text-blue-400 tabular-nums text-sm hidden sm:table-cell">{emp.days_half}</td>
                          <td className="px-5 py-3.5 text-right text-rose-400 tabular-nums text-sm">{emp.days_absent}</td>
                          <td className="px-5 py-3.5 text-right">
                            <span className={`font-bold tabular-nums text-sm ${pctColor}`}>{pct}%</span>
                            <div className="h-1 w-16 bg-slate-700/50 rounded-full ml-auto mt-1 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pct >= 90 ? 'bg-emerald-400' : pct >= 75 ? 'bg-amber-400' : 'bg-rose-400'}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}

// ─── Leave tab ────────────────────────────────────────────────────────────────

function LeaveTab() {
  const [year,  setYear]  = useState(NOW.getFullYear())
  const [data,  setData]  = useState<ILeaveReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async (y: number) => {
    setLoading(true)
    setErr('')
    try {
      setData(await getLeaveReport(y))
    } catch {
      setErr('Failed to load leave report.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(year) }, [load, year])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-indigo-500/50"
        >
          {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="ml-auto">
          <CsvButton onClick={() => downloadReportCSV('leave', { year })} />
        </div>
      </div>

      {err && <p className="text-rose-400 text-sm">{err}</p>}

      {loading ? (
        <div className="p-12 text-center text-slate-600 text-sm">Loading…</div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="Approved Requests" value={data.total_approved_requests} color="emerald" />
            <StatCard label="Total Days Taken"  value={data.total_days_taken.toFixed(1)} color="amber" />
            <StatCard label="Leave Types"       value={data.by_type.length} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* By type */}
            <div className="rounded-2xl border border-slate-800/60 bg-slate-800/10 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800/40">
                <h3 className="text-slate-200 font-semibold text-sm">By Leave Type</h3>
              </div>
              {data.by_type.length === 0 ? (
                <EmptyState message="No leave data for this year." />
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800/40">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Requests</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Days</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {data.by_type.map((t) => (
                      <tr key={t.code} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="text-slate-200 font-medium text-sm">{t.leave_type}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-slate-600 text-xs font-mono">{t.code}</span>
                            <span className={`text-xs ${t.is_paid ? 'text-emerald-500' : 'text-amber-500'}`}>
                              {t.is_paid ? 'Paid' : 'Unpaid'}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right text-slate-200 tabular-nums text-sm font-medium">{t.request_count}</td>
                        <td className="px-5 py-3.5 text-right text-amber-400 tabular-nums text-sm font-semibold">{t.total_days}d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Top takers */}
            <div className="rounded-2xl border border-slate-800/60 bg-slate-800/10 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800/40">
                <h3 className="text-slate-200 font-semibold text-sm">Top Leave Takers</h3>
              </div>
              {data.top_takers.length === 0 ? (
                <EmptyState message="No approved leave for this year." />
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800/40">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Employee</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Requests</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Days</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {data.top_takers.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="text-slate-200 font-medium text-sm">{t.full_name}</p>
                          <p className="text-slate-500 text-xs">{t.email}</p>
                        </td>
                        <td className="px-5 py-3.5 text-right text-slate-300 tabular-nums text-sm">{t.request_count}</td>
                        <td className="px-5 py-3.5 text-right text-amber-400 tabular-nums text-sm font-semibold">{t.total_days}d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

// ─── Payroll tab ──────────────────────────────────────────────────────────────

const PAYROLL_STATUS_COLOR: Record<string, string> = {
  draft:     'bg-slate-500/15 text-slate-400 border-slate-500/25',
  processed: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  approved:  'bg-amber-500/15 text-amber-400 border-amber-500/25',
  paid:      'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
}

function PayrollTab() {
  const [year,  setYear]  = useState(NOW.getFullYear())
  const [data,  setData]  = useState<IPayrollReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async (y: number) => {
    setLoading(true)
    setErr('')
    try {
      setData(await getPayrollReport(y))
    } catch {
      setErr('Failed to load payroll report.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(year) }, [load, year])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-indigo-500/50"
        >
          {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="ml-auto">
          <CsvButton onClick={() => downloadReportCSV('payroll', { year })} />
        </div>
      </div>

      {err && <p className="text-rose-400 text-sm">{err}</p>}

      {loading ? (
        <div className="p-12 text-center text-slate-600 text-sm">Loading…</div>
      ) : data ? (
        <>
          {/* Annual totals */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard label="Total Annual Gross"      value={fmtCurrency(data.total_gross)}      color="blue" />
            <StatCard label="Total Annual Deductions" value={fmtCurrency(data.total_deductions)} color="rose" />
            <StatCard label="Total Annual Net"        value={fmtCurrency(data.total_net)}        color="emerald" />
          </div>

          {/* Monthly breakdown */}
          <div className="rounded-2xl border border-slate-800/60 bg-slate-800/10 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800/40 flex items-center justify-between">
              <h3 className="text-slate-200 font-semibold text-sm">Monthly Breakdown — {year}</h3>
              <span className="text-slate-500 text-xs">{data.months.length} run{data.months.length !== 1 ? 's' : ''}</span>
            </div>

            {data.months.length === 0 ? (
              <EmptyState message="No payroll runs found for this year." />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-800/40">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Month</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Employees</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Gross</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Deductions</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {data.months.map((m, i) => (
                        <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                          <td className="px-5 py-4">
                            <p className="text-slate-200 font-semibold text-sm">{m.month_name}</p>
                            {m.revision > 1 && <p className="text-slate-600 text-xs">Rev. {m.revision}</p>}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border capitalize ${PAYROLL_STATUS_COLOR[m.status] ?? ''}`}>
                              {m.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right text-slate-400 tabular-nums text-sm hidden sm:table-cell">{m.employee_count}</td>
                          <td className="px-5 py-4 text-right text-slate-200 tabular-nums text-sm font-medium">{fmtCurrency(m.total_gross)}</td>
                          <td className="px-5 py-4 text-right text-rose-400 tabular-nums text-sm hidden md:table-cell">-{fmtCurrency(m.total_deductions)}</td>
                          <td className="px-5 py-4 text-right text-emerald-400 tabular-nums text-sm font-bold">{fmtCurrency(m.total_net)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Bar chart — simple CSS bars */}
                {data.months.length > 0 && (
                  <div className="px-5 py-5 border-t border-slate-800/40">
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-4">Net Salary Trend</p>
                    <div className="flex items-end gap-2 h-24">
                      {data.months.map((m, i) => {
                        const maxNet = Math.max(...data.months.map((x) => x.total_net), 1)
                        const pct = (m.total_net / maxNet) * 100
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0 group">
                            <div className="relative w-full flex justify-center">
                              <div
                                className="w-full max-w-8 rounded-t bg-emerald-500/30 group-hover:bg-emerald-500/50 transition-colors"
                                style={{ height: `${Math.max(pct, 4)}%`, minHeight: '4px' }}
                                title={fmtCurrency(m.total_net)}
                              />
                            </div>
                            <span className="text-slate-600 text-[9px] truncate w-full text-center">{m.month_name.slice(0, 3)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Reports() {
  const { user } = useAuthStore()
  const role = user?.role ?? 'employee'
  const isHR = role === 'super_admin' || role === 'hr_admin'
  const canViewAttendance = isHR || role === 'manager'

  if (!canViewAttendance) {
    return (
      <Layout title="Reports">
        <div className="max-w-7xl mx-auto flex flex-col items-center justify-center py-24 text-slate-600">
          <p className="text-sm">Reports are available to HR admins and managers.</p>
        </div>
      </Layout>
    )
  }

  const tabs = [
    { id: 'attendance', label: 'Attendance' },
    ...(isHR ? [
      { id: 'leave',   label: 'Leave' },
      { id: 'payroll', label: 'Payroll' },
    ] : []),
  ]

  const [tab, setTab] = useState(tabs[0].id)

  return (
    <Layout title="Reports">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-slate-100 text-2xl font-bold">Reports</h1>
          <p className="text-slate-500 text-sm mt-1">
            Analytics and exports across attendance, leave, and payroll.
          </p>
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 border-b border-slate-800/60">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-all rounded-t-lg border-b-2 -mb-px ${
                tab === t.id
                  ? 'text-indigo-400 border-indigo-500'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'attendance' && <AttendanceTab />}
        {tab === 'leave'      && <LeaveTab />}
        {tab === 'payroll'    && <PayrollTab />}
      </div>
    </Layout>
  )
}

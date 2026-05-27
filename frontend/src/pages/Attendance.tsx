import { useState, useEffect, useCallback } from 'react'
import Layout from '@/components/app/Layout'
import { listAttendanceLogs, getMyAttendance } from '@/api/attendance'
import { useAuthStore } from '@/store/authStore'
import type { IAttendanceLog, AttendanceStatus } from '@/types/attendance'

// ─── Badges ────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<AttendanceStatus, { label: string; cls: string }> = {
  present:  { label: 'Present',  cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
  late:     { label: 'Late',     cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  absent:   { label: 'Absent',   cls: 'bg-rose-500/15 text-rose-400 border-rose-500/25' },
  half_day: { label: 'Half Day', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
}

function StatusBadge({ status }: { status: AttendanceStatus }) {
  const { label, cls } = STATUS_CFG[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${cls}`}>
      {label}
    </span>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString([], {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function parseUTC(iso: string): Date {
  return new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z')
}

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return parseUTC(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata',
  }) + ' IST'
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-slate-600">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 mb-4 text-slate-700">
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 15" />
      </svg>
      <p className="text-base font-medium text-slate-500">No attendance records</p>
      <p className="text-sm mt-1 text-slate-600">Try adjusting your filters.</p>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

const STATUSES: { value: AttendanceStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'present',  label: 'Present' },
  { value: 'late',     label: 'Late' },
  { value: 'absent',   label: 'Absent' },
  { value: 'half_day', label: 'Half Day' },
]

const LIMIT = 20

export default function Attendance() {
  const { user } = useAuthStore()
  const isEmployee = user?.role === 'employee'
  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin'

  // ── Filters ──
  const [dateFrom, setDateFrom] = useState(today())
  const [dateTo, setDateTo]     = useState(today())
  const [status, setStatus]     = useState<AttendanceStatus | ''>('')

  // ── Data ──
  const [logs, setLogs]       = useState<IAttendanceLog[]>([])
  const [total, setTotal]     = useState(0)
  const [pages, setPages]     = useState(1)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const fetchLogs = useCallback(async (pg: number) => {
    setLoading(true)
    setError('')
    try {
      const params = {
        page: pg,
        limit: LIMIT,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        status: status || undefined,
      }
      const res = isEmployee
        ? await getMyAttendance(params)
        : await listAttendanceLogs(params)
      setLogs(res.items)
      setTotal(res.total)
      setPages(res.pages)
      setPage(pg)
    } catch {
      setError('Failed to load attendance records.')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, status, isEmployee])

  useEffect(() => { fetchLogs(1) }, [fetchLogs])

  // ── Summary counts from current page data ──
  const todayLogs = logs.filter((l) => l.work_date === today())
  const countStatus = (s: AttendanceStatus) => todayLogs.filter((l) => l.status === s).length

  return (
    <Layout title="Attendance">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Stats (only meaningful when looking at today) ── */}
        {dateFrom === today() && dateTo === today() && !isEmployee && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Today',  value: total,                cls: 'text-slate-100' },
              { label: 'Present',      value: countStatus('present'),  cls: 'text-emerald-400' },
              { label: 'Late',         value: countStatus('late'),     cls: 'text-amber-400' },
              { label: 'Absent',       value: countStatus('absent'),   cls: 'text-rose-400' },
            ].map(({ label, value, cls }) => (
              <div key={label} className="rounded-2xl border border-slate-800/60 bg-slate-800/20 p-4">
                <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">{label}</p>
                <p className={`text-3xl font-bold mt-1 ${cls}`}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Filters ── */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-slate-500 text-xs font-medium uppercase tracking-wide">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-slate-800/40 border border-slate-700/50 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-slate-500 text-xs font-medium uppercase tracking-wide">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-slate-800/40 border border-slate-700/50 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-slate-500 text-xs font-medium uppercase tracking-wide">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AttendanceStatus | '')}
              className="bg-slate-800/40 border border-slate-700/50 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => fetchLogs(1)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Apply
          </button>
          <button
            onClick={() => {
              setDateFrom(today())
              setDateTo(today())
              setStatus('')
            }}
            className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm font-medium rounded-lg transition-colors"
          >
            Reset
          </button>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
            {error}
          </div>
        )}

        {/* ── Table ── */}
        <div className="rounded-2xl border border-slate-800/60 bg-slate-800/20 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <svg className="animate-spin w-6 h-6 text-indigo-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            </div>
          ) : logs.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800/60">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                    {!isEmployee && (
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Employee</th>
                    )}
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Check In (IST)</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Check Out (IST)</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Method</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="px-5 py-3.5 text-slate-300 whitespace-nowrap">
                        {fmtDate(log.work_date)}
                      </td>
                      {!isEmployee && (
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 text-xs font-bold shrink-0">
                              {(log.employee?.full_name ?? log.employee?.email ?? '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-slate-200 font-medium">
                                {log.employee?.full_name ?? '—'}
                              </p>
                              <p className="text-slate-500 text-xs">{log.employee?.email ?? log.employee_id.slice(0, 8)}</p>
                            </div>
                          </div>
                        </td>
                      )}
                      <td className="px-5 py-3.5 text-slate-300 tabular-nums whitespace-nowrap">
                        {fmtTime(log.check_in_at)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-300 tabular-nums whitespace-nowrap">
                        {fmtTime(log.check_out_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        {log.check_in_method ? (
                          <span className="text-slate-400 capitalize text-xs">
                            {log.check_in_method}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={log.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Pagination ── */}
        {pages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-slate-500 text-sm">
              {total} record{total !== 1 ? 's' : ''} · page {page} of {pages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => fetchLogs(page - 1)}
                disabled={page <= 1 || loading}
                className="px-3 py-1.5 rounded-lg border border-slate-700/50 text-slate-400 hover:text-slate-200 hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed text-sm transition-colors"
              >
                ← Prev
              </button>
              <button
                onClick={() => fetchLogs(page + 1)}
                disabled={page >= pages || loading}
                className="px-3 py-1.5 rounded-lg border border-slate-700/50 text-slate-400 hover:text-slate-200 hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed text-sm transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}

      </div>
    </Layout>
  )
}

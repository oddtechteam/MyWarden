import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '@/components/app/Layout'
import { useAuthStore } from '@/store/authStore'
import { listAttendanceLogs, getMyAttendance } from '@/api/attendance'
import { listLeaveRequests, getMyBalances } from '@/api/leave'
import { listEmployees } from '@/api/employees'
import type { IAttendanceLog, AttendanceStatus } from '@/types/attendance'
import type { ILeaveRequest, ILeaveBalance, LeaveStatus } from '@/types/leave'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
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

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

function greeting() {
  const h = parseInt(new Date().toLocaleString('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }))
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ─── Badges ───────────────────────────────────────────────────────────────────

const ATT_CFG: Record<AttendanceStatus, { label: string; cls: string }> = {
  present:  { label: 'On Time',  cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
  late:     { label: 'Late',     cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  absent:   { label: 'Absent',   cls: 'bg-rose-500/15 text-rose-400 border-rose-500/25' },
  half_day: { label: 'Half Day', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
}

function AttBadge({ status }: { status: AttendanceStatus }) {
  const { label, cls } = ATT_CFG[status]
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${cls}`}>{label}</span>
}

const LV_CFG: Record<LeaveStatus, { label: string; cls: string }> = {
  pending:   { label: 'Pending',   cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  approved:  { label: 'Approved',  cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
  rejected:  { label: 'Rejected',  cls: 'bg-rose-500/15 text-rose-400 border-rose-500/25' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/25' },
}

function LvBadge({ status }: { status: LeaveStatus }) {
  const { label, cls } = LV_CFG[status]
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${cls}`}>{label}</span>
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, gradient, loading,
}: {
  label: string; value: string | number; sub?: string; gradient: string; loading: boolean
}) {
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-5 ${gradient}`}>
      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3">{label}</p>
      {loading
        ? <div className="h-8 w-16 bg-slate-700/50 rounded animate-pulse" />
        : <p className="text-3xl font-bold text-slate-100">{value}</p>
      }
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

// ─── Panel shell ──────────────────────────────────────────────────────────────

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-800/20 flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60 shrink-0">
        <h3 className="text-slate-200 font-semibold text-sm">{title}</h3>
        {action}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-600">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 mb-2 text-slate-700">
        <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 15" />
      </svg>
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <svg className="animate-spin w-5 h-5 text-indigo-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    </div>
  )
}

// ─── HR / Manager Dashboard ───────────────────────────────────────────────────

function AdminDashboard({ isManager }: { isManager: boolean }) {
  const navigate = useNavigate()
  const today = todayIST()

  const [statsLoading, setStatsLoading] = useState(true)
  const [totalEmployees, setTotalEmployees] = useState(0)
  const [presentToday, setPresentToday] = useState(0)
  const [lateToday, setLateToday] = useState(0)
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0)

  const [activityLoading, setActivityLoading] = useState(true)
  const [recentLogs, setRecentLogs] = useState<IAttendanceLog[]>([])

  const [approvalsLoading, setApprovalsLoading] = useState(true)
  const [pendingLeaves, setPendingLeaves] = useState<ILeaveRequest[]>([])

  useEffect(() => {
    async function loadStats() {
      setStatsLoading(true)
      try {
        const [empRes, presentRes, lateRes, pendingRes] = await Promise.all([
          isManager ? Promise.resolve(null) : listEmployees({ limit: 1, is_active: true }),
          listAttendanceLogs({ date_from: today, date_to: today, status: 'present', limit: 1 }),
          listAttendanceLogs({ date_from: today, date_to: today, status: 'late', limit: 1 }),
          listLeaveRequests({ status: 'pending', limit: 1 }),
        ])
        if (empRes) setTotalEmployees(empRes.total)
        setPresentToday(presentRes.total)
        setLateToday(lateRes.total)
        setPendingLeaveCount(pendingRes.total)
      } catch { /* stats are non-critical */ }
      finally { setStatsLoading(false) }
    }

    async function loadActivity() {
      setActivityLoading(true)
      try {
        const res = await listAttendanceLogs({ date_from: today, date_to: today, limit: 6 })
        setRecentLogs(res.items)
      } catch { /* silent */ }
      finally { setActivityLoading(false) }
    }

    async function loadApprovals() {
      setApprovalsLoading(true)
      try {
        const res = await listLeaveRequests({ status: 'pending', limit: 5 })
        setPendingLeaves(res.items)
      } catch { /* silent */ }
      finally { setApprovalsLoading(false) }
    }

    loadStats()
    loadActivity()
    loadApprovals()
  }, [today, isManager])

  const stats = isManager
    ? [
        { label: 'Present Today',      value: presentToday, sub: 'on time',        gradient: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20' },
        { label: 'Late Today',         value: lateToday,    sub: 'after grace',     gradient: 'from-amber-500/20 to-amber-600/10 border-amber-500/20' },
        { label: 'Pending Approvals',  value: pendingLeaveCount, sub: 'leave requests', gradient: 'from-violet-500/20 to-violet-600/10 border-violet-500/20' },
        { label: 'Checked In',         value: presentToday + lateToday, sub: 'total today', gradient: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/20' },
      ]
    : [
        { label: 'Total Employees',    value: totalEmployees, sub: 'active',        gradient: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/20' },
        { label: 'Present Today',      value: presentToday,  sub: 'on time',        gradient: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20' },
        { label: 'Late Today',         value: lateToday,     sub: 'after grace',    gradient: 'from-amber-500/20 to-amber-600/10 border-amber-500/20' },
        { label: 'Pending Approvals',  value: pendingLeaveCount, sub: 'leave requests', gradient: 'from-violet-500/20 to-violet-600/10 border-violet-500/20' },
      ]

  return (
    <>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <StatCard key={s.label} loading={statsLoading} {...s} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent attendance activity */}
        <Panel title={`Today's Attendance — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}`}>
          {activityLoading ? <Spinner /> : recentLogs.length === 0 ? (
            <Empty text="No check-ins yet today" />
          ) : (
            <ul className="divide-y divide-slate-800/40">
              {recentLogs.map((log) => (
                <li key={log.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-800/20 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 text-xs font-bold shrink-0">
                    {(log.employee?.full_name ?? log.employee?.email ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 text-sm font-medium truncate">
                      {log.employee?.full_name ?? log.employee?.email ?? '—'}
                    </p>
                    <p className="text-slate-500 text-xs tabular-nums">
                      In {fmtTime(log.check_in_at)}
                      {log.check_out_at && <span className="ml-2">· Out {fmtTime(log.check_out_at)}</span>}
                    </p>
                  </div>
                  <AttBadge status={log.status} />
                </li>
              ))}
            </ul>
          )}
          <div className="px-5 py-3 border-t border-slate-800/60">
            <button
              onClick={() => navigate('/attendance')}
              className="text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-colors"
            >
              View all attendance →
            </button>
          </div>
        </Panel>

        {/* Pending leave approvals */}
        <Panel
          title="Pending Leave Approvals"
          action={
            pendingLeaveCount > 5
              ? <span className="text-amber-400 text-xs font-medium">+{pendingLeaveCount - 5} more</span>
              : undefined
          }
        >
          {approvalsLoading ? <Spinner /> : pendingLeaves.length === 0 ? (
            <Empty text="All caught up — no pending requests" />
          ) : (
            <ul className="divide-y divide-slate-800/40">
              {pendingLeaves.map((req) => {
                const name = req.employee?.full_name ?? req.employee?.email ?? '—'
                const initials = name === '—' ? '?' : name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
                return (
                  <li key={req.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-800/20 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-200 text-sm font-medium truncate">{name}</p>
                      <p className="text-slate-500 text-xs">
                        {req.leave_type.name} · {fmtDate(req.start_date)} → {fmtDate(req.end_date)}
                        <span className="ml-1 text-slate-600">({req.days_requested}d)</span>
                      </p>
                    </div>
                    <LvBadge status={req.status} />
                  </li>
                )
              })}
            </ul>
          )}
          <div className="px-5 py-3 border-t border-slate-800/60">
            <button
              onClick={() => navigate('/leave')}
              className="text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-colors"
            >
              Review in Leave module →
            </button>
          </div>
        </Panel>
      </div>
    </>
  )
}

// ─── Employee Dashboard ───────────────────────────────────────────────────────

function EmployeeDashboard() {
  const navigate = useNavigate()
  const today = todayIST()

  const [loading, setLoading] = useState(true)
  const [todayLog, setTodayLog] = useState<IAttendanceLog | null>(null)
  const [balances, setBalances] = useState<ILeaveBalance[]>([])
  const [myPending, setMyPending] = useState<ILeaveRequest[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [attRes, balRes, lvRes] = await Promise.all([
          getMyAttendance({ date_from: today, date_to: today, limit: 1 }),
          getMyBalances(),
          listLeaveRequests({ status: 'pending', limit: 5 }),
        ])
        setTodayLog(attRes.items[0] ?? null)
        setBalances(balRes)
        setMyPending(lvRes.items)
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  }, [today])

  const totalRemaining = balances.reduce((sum, b) => sum + parseFloat(b.remaining), 0)

  const checkInStatus = todayLog
    ? ATT_CFG[todayLog.status].label
    : 'Not checked in'

  const stats = [
    {
      label: "Today's Status",
      value: todayLog ? ATT_CFG[todayLog.status].label : '—',
      sub: todayLog ? `In ${fmtTime(todayLog.check_in_at)}` : 'No check-in recorded',
      gradient: todayLog?.status === 'present'
        ? 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20'
        : todayLog?.status === 'late'
        ? 'from-amber-500/20 to-amber-600/10 border-amber-500/20'
        : 'from-slate-700/20 to-slate-800/10 border-slate-700/30',
    },
    {
      label: 'Leave Remaining',
      value: `${totalRemaining.toFixed(1)}d`,
      sub: `across ${balances.length} leave type${balances.length !== 1 ? 's' : ''}`,
      gradient: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/20',
    },
    {
      label: 'Pending Requests',
      value: myPending.length,
      sub: 'awaiting approval',
      gradient: myPending.length > 0
        ? 'from-amber-500/20 to-amber-600/10 border-amber-500/20'
        : 'from-slate-700/20 to-slate-800/10 border-slate-700/30',
    },
    {
      label: 'Check-out',
      value: todayLog?.check_out_at ? fmtTime(todayLog.check_out_at) : '—',
      sub: todayLog?.check_out_at ? 'recorded' : 'not yet',
      gradient: 'from-violet-500/20 to-violet-600/10 border-violet-500/20',
    },
  ]

  return (
    <>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <StatCard key={s.label} loading={loading} {...s} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's attendance detail */}
        <Panel title="Today's Attendance">
          {loading ? <Spinner /> : !todayLog ? (
            <Empty text="No attendance recorded yet today" />
          ) : (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Check In', value: fmtTime(todayLog.check_in_at) },
                  { label: 'Check Out', value: fmtTime(todayLog.check_out_at) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-slate-700/50 bg-slate-800/30 px-4 py-3">
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-1">{label}</p>
                    <p className="text-slate-200 font-semibold tabular-nums">{value}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-700/50 bg-slate-800/30 px-4 py-3">
                <span className="text-slate-500 text-sm">Status</span>
                <AttBadge status={todayLog.status} />
              </div>
              {todayLog.check_in_method && (
                <p className="text-slate-600 text-xs text-center">
                  Method: <span className="capitalize text-slate-500">{todayLog.check_in_method}</span>
                </p>
              )}
            </div>
          )}
          <div className="px-5 py-3 border-t border-slate-800/60">
            <button
              onClick={() => navigate('/attendance')}
              className="text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-colors"
            >
              View attendance history →
            </button>
          </div>
        </Panel>

        {/* Leave balances + pending */}
        <Panel title="Leave Overview">
          {loading ? <Spinner /> : (
            <div className="p-5 space-y-3">
              {balances.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No leave balances yet. Apply for leave to initialize.</p>
              ) : (
                balances.map((b) => {
                  const pct = parseFloat(b.allocated) > 0
                    ? Math.min(100, (parseFloat(b.used) / parseFloat(b.allocated)) * 100)
                    : 0
                  const isLow = parseFloat(b.remaining) <= parseFloat(b.allocated) * 0.2
                  return (
                    <div key={b.id} className="rounded-xl border border-slate-700/50 bg-slate-800/30 px-4 py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-slate-300 text-sm font-medium">{b.leave_type.name}</span>
                        <span className={`text-sm font-bold tabular-nums ${isLow ? 'text-rose-400' : 'text-slate-100'}`}>
                          {b.remaining}
                          <span className="text-slate-500 font-normal text-xs ml-1">/ {b.allocated}d</span>
                        </span>
                      </div>
                      <div className="h-1 bg-slate-700/50 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isLow ? 'bg-rose-400' : pct > 60 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              )}

              {myPending.length > 0 && (
                <div className="pt-2 border-t border-slate-800/60">
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2">Pending Requests</p>
                  {myPending.map((req) => (
                    <div key={req.id} className="flex items-center justify-between py-1.5">
                      <div>
                        <p className="text-slate-300 text-sm">{req.leave_type.name}</p>
                        <p className="text-slate-500 text-xs">{fmtDate(req.start_date)} → {fmtDate(req.end_date)}</p>
                      </div>
                      <LvBadge status={req.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="px-5 py-3 border-t border-slate-800/60">
            <button
              onClick={() => navigate('/leave')}
              className="text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-colors"
            >
              Go to Leave module →
            </button>
          </div>
        </Panel>
      </div>
    </>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuthStore()
  const role = user?.role ?? 'employee'
  const isEmployee = role === 'employee'
  const isManager = role === 'manager'

  return (
    <Layout title="Dashboard">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-100">
            {greeting()},{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
              {user?.full_name?.split(' ')[0] ?? 'there'}
            </span>
            !
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              timeZone: 'Asia/Kolkata',
            })}
          </p>
        </div>

        {isEmployee
          ? <EmployeeDashboard />
          : <AdminDashboard isManager={isManager} />
        }
      </div>
    </Layout>
  )
}

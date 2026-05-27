import { useState, useEffect, useCallback, useRef } from 'react'
import Layout from '@/components/app/Layout'
import { useAuthStore } from '@/store/authStore'
import {
  listLeaveTypes,
  getMyBalances,
  applyLeave,
  listLeaveRequests,
  approveLeave,
  rejectLeave,
  cancelLeave,
  createLeaveType,
  updateLeaveType,
} from '@/api/leave'
import type { ILeaveBalance, ILeaveRequest, ILeaveType, LeaveStatus } from '@/types/leave'

// ─── Utilities ───────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString([], {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function calcDays(from: string, to: string): number {
  if (!from || !to) return 0
  return Math.max(0, Math.floor(
    (new Date(to).getTime() - new Date(from).getTime()) / 86400000,
  ) + 1)
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  return `${d} days ago`
}

// ─── Status badge ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<LeaveStatus, { label: string; cls: string }> = {
  pending:   { label: 'Pending',   cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  approved:  { label: 'Approved',  cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
  rejected:  { label: 'Rejected',  cls: 'bg-rose-500/15 text-rose-400 border-rose-500/25' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/25' },
}

function StatusBadge({ status }: { status: LeaveStatus }) {
  const { label, cls } = STATUS_CFG[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${cls}`}>
      {label}
    </span>
  )
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({ message, type, onDone }: { message: string; type: 'success' | 'error'; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl text-sm font-medium animate-slide-up ${
      type === 'success'
        ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300'
        : 'bg-rose-950/90 border-rose-500/30 text-rose-300'
    }`}>
      {type === 'success'
        ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
        : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 shrink-0"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      }
      {message}
    </div>
  )
}

// ─── Balance cards ────────────────────────────────────────────────────────────

function BalanceCard({ balance }: { balance: ILeaveBalance }) {
  const allocated = parseFloat(balance.allocated)
  const used = parseFloat(balance.used)
  const remaining = parseFloat(balance.remaining)
  const pct = allocated > 0 ? Math.min(100, (used / allocated) * 100) : 0
  const isLow = remaining <= allocated * 0.2

  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-800/20 p-5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-slate-200 font-semibold text-sm">{balance.leave_type.name}</p>
          <p className="text-slate-500 text-xs mt-0.5">
            {balance.leave_type.is_paid ? 'Paid' : 'Unpaid'} · {balance.leave_type.days_per_year}d/yr
          </p>
        </div>
        <span className="text-slate-500 text-xs bg-slate-800/60 px-2 py-0.5 rounded-md border border-slate-700/50 tabular-nums shrink-0">
          {balance.leave_type.code}
        </span>
      </div>

      <p className={`text-2xl font-bold tabular-nums ${isLow ? 'text-rose-400' : 'text-slate-100'}`}>
        {remaining}
        <span className="text-slate-500 font-normal text-sm ml-1">/ {allocated} days</span>
      </p>

      <div className="mt-3 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isLow ? 'bg-rose-400' : pct > 60 ? 'bg-amber-400' : 'bg-emerald-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-slate-600 text-xs mt-1.5">{Math.round(pct)}% used</p>
    </div>
  )
}

// ─── Apply drawer ─────────────────────────────────────────────────────────────

function ApplyDrawer({
  balances,
  onClose,
  onSubmit,
}: {
  balances: ILeaveBalance[]
  onClose: () => void
  onSubmit: (payload: { leave_type_id: string; start_date: string; end_date: string; reason?: string }) => Promise<void>
}) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const [leaveTypes, setLeaveTypes] = useState<ILeaveType[]>([])
  const [typesLoading, setTypesLoading] = useState(true)
  const [typeId, setTypeId] = useState('')
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    setTypesLoading(true)
    listLeaveTypes(false)
      .then((data) => {
        setLeaveTypes(data)
        if (data.length > 0) setTypeId(data[0].id)
      })
      .finally(() => setTypesLoading(false))
  }, [])

  const days = calcDays(from, to)
  const balance = balances.find((b) => b.leave_type_id === typeId)
  const remaining = balance ? parseFloat(balance.remaining) : null

  async function handleSubmit() {
    if (!typeId || !from || !to || days < 1) return
    setSubmitting(true)
    setErr('')
    try {
      await onSubmit({ leave_type_id: typeId, start_date: from, end_date: to, reason: reason || undefined })
      onClose()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
      setErr(msg ?? 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-slate-900 border-l border-slate-800/60 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800/60 shrink-0">
          <div>
            <h2 className="text-slate-100 font-semibold">Apply for Leave</h2>
            <p className="text-slate-500 text-xs mt-0.5">Submit a new leave request</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Leave type */}
          <div className="space-y-1.5">
            <label className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Leave Type</label>
            {typesLoading ? (
              <div className="h-10 bg-slate-800/40 border border-slate-700/50 rounded-lg animate-pulse" />
            ) : leaveTypes.length === 0 ? (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-amber-400 text-sm">
                No active leave types. Ask HR to configure leave types first.
              </div>
            ) : (
              <select
                value={typeId}
                onChange={(e) => setTypeId(e.target.value)}
                className="w-full bg-slate-800/40 border border-slate-700/50 text-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {leaveTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code}) — {t.days_per_year}d/yr · {t.is_paid ? 'Paid' : 'Unpaid'}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-slate-400 text-xs font-semibold uppercase tracking-wide">From</label>
              <input
                type="date"
                value={from}
                min={today}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full bg-slate-800/40 border border-slate-700/50 text-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-400 text-xs font-semibold uppercase tracking-wide">To</label>
              <input
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
                className="w-full bg-slate-800/40 border border-slate-700/50 text-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Duration info */}
          {days > 0 && (
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 px-4 py-3 flex items-center justify-between">
              <span className="text-slate-400 text-sm">Duration</span>
              <span className="text-slate-200 font-semibold text-sm">{days} calendar day{days !== 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Balance info */}
          {balance && (
            <div className={`rounded-xl border px-4 py-3 flex items-center justify-between text-sm ${
              remaining !== null && days > remaining
                ? 'border-rose-500/30 bg-rose-500/10'
                : 'border-slate-700/50 bg-slate-800/30'
            }`}>
              <span className="text-slate-400">Balance remaining</span>
              <span className={`font-semibold ${remaining !== null && days > remaining ? 'text-rose-400' : 'text-slate-200'}`}>
                {balance.remaining} days
              </span>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Reason <span className="text-slate-600 normal-case font-normal">(optional)</span></label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Brief description…"
              className="w-full bg-slate-800/40 border border-slate-700/50 text-slate-200 placeholder-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          {err && (
            <p className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2.5">{err}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800/60 shrink-0 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-700/50 text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || days < 1 || leaveTypes.length === 0 || (remaining !== null && days > remaining)}
            className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Review modal ─────────────────────────────────────────────────────────────

function ReviewModal({
  request,
  onClose,
  onAction,
}: {
  request: ILeaveRequest
  onClose: () => void
  onAction: (action: 'approve' | 'reject', note: string) => Promise<void>
}) {
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  async function handle(action: 'approve' | 'reject') {
    setLoading(true)
    try { await onAction(action, note) } finally { setLoading(false) }
  }

  const name = request.employee?.full_name ?? request.employee?.email ?? request.employee_id.slice(0, 8)

  return (
    <>
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800/60 rounded-2xl w-full max-w-md shadow-2xl">
          <div className="px-6 py-5 border-b border-slate-800/60 flex items-center justify-between">
            <h2 className="text-slate-100 font-semibold">Review Request</h2>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* Request summary */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Employee</span>
                <span className="text-slate-200 font-medium">{name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Leave Type</span>
                <span className="text-slate-200">{request.leave_type.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Period</span>
                <span className="text-slate-200">{fmtDate(request.start_date)} → {fmtDate(request.end_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Days</span>
                <span className="text-slate-200 font-semibold">{request.days_requested}</span>
              </div>
              {request.reason && (
                <div className="pt-1 border-t border-slate-700/40">
                  <p className="text-slate-500 text-xs mb-1">Reason</p>
                  <p className="text-slate-300 text-xs">{request.reason}</p>
                </div>
              )}
            </div>

            {/* Review note */}
            <div className="space-y-1.5">
              <label className="text-slate-400 text-xs font-semibold uppercase tracking-wide">
                Note <span className="text-slate-600 font-normal normal-case">(optional)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Add a comment for the employee…"
                className="w-full bg-slate-800/40 border border-slate-700/50 text-slate-200 placeholder-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              />
            </div>
          </div>

          <div className="px-6 pb-5 flex gap-3">
            <button
              onClick={() => handle('reject')}
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 disabled:opacity-50 text-sm font-semibold transition-colors"
            >
              Reject
            </button>
            <button
              onClick={() => handle('approve')}
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              {loading ? 'Saving…' : 'Approve'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Pending card ─────────────────────────────────────────────────────────────

function PendingCard({
  request,
  onReview,
}: {
  request: ILeaveRequest
  onReview: (r: ILeaveRequest) => void
}) {
  const name = request.employee?.full_name ?? request.employee?.email ?? '—'
  const initials = name === '—' ? '?' : name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-800/20 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-slate-200 font-semibold text-sm">{name}</p>
            <span className="text-slate-500 text-xs bg-slate-800/60 px-2 py-0.5 rounded-md border border-slate-700/50">
              {request.leave_type.code}
            </span>
            {!request.leave_type.is_paid && (
              <span className="text-amber-400 text-xs">Unpaid</span>
            )}
          </div>
          <p className="text-slate-400 text-sm mt-0.5">
            {fmtDate(request.start_date)} → {fmtDate(request.end_date)}
            <span className="text-slate-500 ml-2">· {request.days_requested} day{request.days_requested !== '1.0' ? 's' : ''}</span>
          </p>
          {request.reason && (
            <p className="text-slate-500 text-xs mt-1 truncate">"{request.reason}"</p>
          )}
          <p className="text-slate-600 text-xs mt-1">{timeAgo(request.created_at)}</p>
        </div>
      </div>
      <button
        onClick={() => onReview(request)}
        className="px-4 py-2 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/30 text-sm font-medium transition-colors shrink-0"
      >
        Review
      </button>
    </div>
  )
}

// ─── Requests table ────────────────────────────────────────────────────────────

function RequestsTable({
  requests,
  showEmployee,
  onCancel,
  onReview,
  total,
  page,
  pages,
  onPage,
  loading,
}: {
  requests: ILeaveRequest[]
  showEmployee: boolean
  onCancel?: (id: string) => void
  onReview?: (r: ILeaveRequest) => void
  total: number
  page: number
  pages: number
  onPage: (p: number) => void
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="animate-spin w-6 h-6 text-indigo-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-600">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 mb-3 text-slate-700">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <p className="text-slate-500 font-medium">No requests found</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-800/60 bg-slate-800/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800/60">
                {showEmployee && (
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Employee</th>
                )}
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Period</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Days</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-800/30 transition-colors">
                  {showEmployee && (
                    <td className="px-5 py-3.5">
                      <p className="text-slate-200 font-medium">{req.employee?.full_name ?? '—'}</p>
                      <p className="text-slate-500 text-xs">{req.employee?.email ?? req.employee_id.slice(0, 8)}</p>
                    </td>
                  )}
                  <td className="px-5 py-3.5">
                    <p className="text-slate-200">{req.leave_type.name}</p>
                    {!req.leave_type.is_paid && <p className="text-amber-500 text-xs">Unpaid</p>}
                  </td>
                  <td className="px-5 py-3.5 text-slate-300 whitespace-nowrap">
                    {fmtDate(req.start_date)}
                    {req.start_date !== req.end_date && <span className="text-slate-600"> → {fmtDate(req.end_date)}</span>}
                  </td>
                  <td className="px-5 py-3.5 text-slate-300 tabular-nums">{req.days_requested}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-col gap-1">
                      <StatusBadge status={req.status} />
                      {req.review_note && (
                        <p className="text-slate-600 text-xs truncate max-w-32" title={req.review_note}>
                          {req.review_note}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {req.status === 'pending' && onCancel && (
                      <button
                        onClick={() => onCancel(req.id)}
                        className="text-xs text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                    {req.status === 'pending' && onReview && (
                      <button
                        onClick={() => onReview(req)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        Review
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-slate-500 text-sm">{total} requests · page {page} of {pages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => onPage(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-slate-700/50 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-sm transition-colors"
            >
              ← Prev
            </button>
            <button
              onClick={() => onPage(page + 1)}
              disabled={page >= pages}
              className="px-3 py-1.5 rounded-lg border border-slate-700/50 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-sm transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Leave types tab (HR) ─────────────────────────────────────────────────────

function LeaveTypesTab({ types, onRefresh }: { types: ILeaveType[]; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', days_per_year: 10, is_paid: true })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleCreate() {
    setSaving(true)
    setErr('')
    try {
      await createLeaveType({ ...form, code: form.code.toUpperCase() })
      setShowAdd(false)
      setForm({ name: '', code: '', days_per_year: 10, is_paid: true })
      onRefresh()
    } catch (e: unknown) {
      setErr((e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? 'Failed to create')
    } finally { setSaving(false) }
  }

  async function handleToggle(t: ILeaveType) {
    await updateLeaveType(t.id, { is_active: !t.is_active })
    onRefresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
        >
          + Add Leave Type
        </button>
      </div>

      {showAdd && (
        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-5 space-y-4">
          <h3 className="text-slate-200 font-semibold text-sm">New Leave Type</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-slate-500 text-xs font-semibold uppercase tracking-wide">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Annual Leave"
                className="w-full bg-slate-800/40 border border-slate-700/50 text-slate-200 placeholder-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-500 text-xs font-semibold uppercase tracking-wide">Code</label>
              <input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="AL"
                maxLength={10}
                className="w-full bg-slate-800/40 border border-slate-700/50 text-slate-200 placeholder-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-500 text-xs font-semibold uppercase tracking-wide">Days / Year</label>
              <input
                type="number"
                min={1}
                value={form.days_per_year}
                onChange={(e) => setForm((f) => ({ ...f, days_per_year: parseInt(e.target.value) || 0 }))}
                className="w-full bg-slate-800/40 border border-slate-700/50 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-500 text-xs font-semibold uppercase tracking-wide">Paid Leave</label>
              <select
                value={form.is_paid ? 'yes' : 'no'}
                onChange={(e) => setForm((f) => ({ ...f, is_paid: e.target.value === 'yes' }))}
                className="w-full bg-slate-800/40 border border-slate-700/50 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="yes">Paid</option>
                <option value="no">Unpaid</option>
              </select>
            </div>
          </div>
          {err && <p className="text-rose-400 text-sm">{err}</p>}
          <div className="flex gap-3">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors">Cancel</button>
            <button
              onClick={handleCreate}
              disabled={saving || !form.name || !form.code}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : 'Create'}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-800/60 bg-slate-800/20 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800/60">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Code</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Days/yr</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {types.map((t) => (
              <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-5 py-3.5 text-slate-200 font-medium">{t.name}</td>
                <td className="px-5 py-3.5">
                  <span className="text-slate-400 text-xs bg-slate-800/60 px-2 py-0.5 rounded-md border border-slate-700/50 font-mono">{t.code}</span>
                </td>
                <td className="px-5 py-3.5 text-slate-300 tabular-nums">{t.days_per_year}</td>
                <td className="px-5 py-3.5 text-slate-400">{t.is_paid ? 'Paid' : 'Unpaid'}</td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs font-medium ${t.is_active ? 'text-emerald-400' : 'text-slate-600'}`}>
                    {t.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    onClick={() => handleToggle(t)}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {t.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
            {types.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-slate-600">No leave types yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const LIMIT = 15

export default function Leave() {
  const { user } = useAuthStore()
  const role = user?.role ?? 'employee'
  const isEmployee = role === 'employee'
  const isHR = role === 'super_admin' || role === 'hr_admin'
  const canReview = isHR || role === 'manager'

  const tabs = isEmployee
    ? [{ id: 'my', label: 'My Requests' }]
    : isHR
    ? [
        { id: 'pending', label: 'Pending Approval' },
        { id: 'all', label: 'All Requests' },
        { id: 'types', label: 'Leave Types' },
      ]
    : [
        { id: 'pending', label: 'Pending Approval' },
        { id: 'all', label: 'All Requests' },
      ]

  const [tab, setTab] = useState(tabs[0].id)
  const [leaveTypes, setLeaveTypes] = useState<ILeaveType[]>([])
  const [balances, setBalances] = useState<ILeaveBalance[]>([])
  const [myRequests, setMyRequests] = useState<ILeaveRequest[]>([])
  const [myTotal, setMyTotal] = useState(0)
  const [myPage, setMyPage] = useState(1)
  const [myPages, setMyPages] = useState(1)
  const [pending, setPending] = useState<ILeaveRequest[]>([])
  const [allRequests, setAllRequests] = useState<ILeaveRequest[]>([])
  const [allTotal, setAllTotal] = useState(0)
  const [allPage, setAllPage] = useState(1)
  const [allPages, setAllPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [showApply, setShowApply] = useState(false)
  const [reviewTarget, setReviewTarget] = useState<ILeaveRequest | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
  }, [])

  // ── Fetch helpers ──

  const fetchTypes = useCallback(async () => {
    const data = await listLeaveTypes(isHR)
    setLeaveTypes(data)
  }, [isHR])

  const fetchBalances = useCallback(async () => {
    if (!isEmployee) return
    const data = await getMyBalances()
    setBalances(data)
  }, [isEmployee])

  const fetchMyRequests = useCallback(async (pg = 1) => {
    setLoading(true)
    try {
      const res = await listLeaveRequests({ page: pg, limit: LIMIT })
      setMyRequests(res.items)
      setMyTotal(res.total)
      setMyPage(pg)
      setMyPages(res.pages)
    } finally { setLoading(false) }
  }, [])

  const fetchPending = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listLeaveRequests({ status: 'pending', limit: 50 })
      setPending(res.items)
    } finally { setLoading(false) }
  }, [])

  const fetchAll = useCallback(async (pg = 1) => {
    setLoading(true)
    try {
      const res = await listLeaveRequests({ page: pg, limit: LIMIT })
      setAllRequests(res.items)
      setAllTotal(res.total)
      setAllPage(pg)
      setAllPages(res.pages)
    } finally { setLoading(false) }
  }, [])

  // ── Bootstrap ──

  useEffect(() => {
    fetchTypes()
    if (isEmployee) { fetchBalances(); fetchMyRequests() }
    else { fetchPending() }
  }, [fetchTypes, fetchBalances, fetchMyRequests, fetchPending, isEmployee])

  useEffect(() => {
    if (tab === 'all') fetchAll(1)
    if (tab === 'pending') fetchPending()
    if (tab === 'my') fetchMyRequests(1)
  }, [tab, fetchAll, fetchPending, fetchMyRequests])

  // ── Actions ──

  async function handleApply(payload: { leave_type_id: string; start_date: string; end_date: string; reason?: string }) {
    await applyLeave(payload)
    showToast('Leave request submitted')
    fetchMyRequests(1)
    fetchBalances()
  }

  async function handleCancel(id: string) {
    await cancelLeave(id)
    showToast('Request cancelled')
    fetchMyRequests(myPage)
    fetchBalances()
  }

  async function handleReview(action: 'approve' | 'reject', note: string) {
    if (!reviewTarget) return
    if (action === 'approve') await approveLeave(reviewTarget.id, note)
    else await rejectLeave(reviewTarget.id, note)
    showToast(`Request ${action === 'approve' ? 'approved' : 'rejected'}`)
    setReviewTarget(null)
    fetchPending()
    if (tab === 'all') fetchAll(allPage)
  }

  return (
    <Layout title="Leave">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header row ── */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1 p-1 bg-slate-900/40 rounded-xl border border-slate-800/60">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
                {t.id === 'pending' && pending.length > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
                    {pending.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {isEmployee && (
            <button
              onClick={() => setShowApply(true)}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors shadow-md shadow-indigo-500/15"
            >
              + Apply for Leave
            </button>
          )}
        </div>

        {/* ── Balance cards (employee) ── */}
        {isEmployee && tab === 'my' && balances.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {balances.map((b) => <BalanceCard key={b.id} balance={b} />)}
          </div>
        )}

        {/* ── Tab content ── */}
        {tab === 'my' && (
          <RequestsTable
            requests={myRequests}
            showEmployee={false}
            onCancel={handleCancel}
            total={myTotal}
            page={myPage}
            pages={myPages}
            onPage={fetchMyRequests}
            loading={loading}
          />
        )}

        {tab === 'pending' && (
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <svg className="animate-spin w-6 h-6 text-indigo-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              </div>
            ) : pending.length === 0 ? (
              <div className="rounded-2xl border border-slate-800/60 bg-slate-800/20 flex flex-col items-center justify-center py-20 text-slate-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 mb-3 text-slate-700">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <p className="text-slate-500 font-medium">All caught up</p>
                <p className="text-sm mt-1">No pending requests to review.</p>
              </div>
            ) : (
              pending.map((r) => (
                <PendingCard key={r.id} request={r} onReview={setReviewTarget} />
              ))
            )}
          </div>
        )}

        {tab === 'all' && (
          <RequestsTable
            requests={allRequests}
            showEmployee={canReview}
            onReview={canReview ? setReviewTarget : undefined}
            total={allTotal}
            page={allPage}
            pages={allPages}
            onPage={fetchAll}
            loading={loading}
          />
        )}

        {tab === 'types' && isHR && (
          <LeaveTypesTab types={leaveTypes} onRefresh={fetchTypes} />
        )}

      </div>

      {/* ── Drawers & modals ── */}
      {showApply && (
        <ApplyDrawer
          balances={balances}
          onClose={() => setShowApply(false)}
          onSubmit={handleApply}
        />
      )}

      {reviewTarget && (
        <ReviewModal
          request={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onAction={handleReview}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
    </Layout>
  )
}

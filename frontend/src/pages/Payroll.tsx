import { useState, useEffect, useCallback } from 'react'
import Layout from '@/components/app/Layout'
import { useAuthStore } from '@/store/authStore'
import {
  listPayrollRuns,
  createPayrollRun,
  getPayrollRun,
  processRun,
  approveRun,
  markPaid,
  downloadPayslip,
  myPayrollEntries,
  listDeductionRules,
  createDeductionRule,
  updateDeductionRule,
  deactivateDeductionRule,
} from '@/api/payroll'
import type { IPayrollRun, IPayrollRunDetail, IPayrollEntry, IDeductionRule } from '@/types/payroll'
import type { PayrollStatus } from '@/types/payroll'

// ─── Constants ───────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const MONTH_ABBR = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

// ─── Utilities ────────────────────────────────────────────────────────────────

function fmtCurrency(val: string | number) {
  return '₹' + parseFloat(String(val)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z')
    .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
}

function periodLabel(year: number, month: number) {
  return `${MONTH_NAMES[month]} ${year}`
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

// ─── Status badge + pipeline ──────────────────────────────────────────────────

const STATUS_CFG: Record<PayrollStatus, { label: string; cls: string; dot: string }> = {
  draft:     { label: 'Draft',     cls: 'bg-slate-500/15 text-slate-400 border-slate-500/25',    dot: 'bg-slate-500' },
  processed: { label: 'Processed', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25',        dot: 'bg-blue-400' },
  approved:  { label: 'Approved',  cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25',     dot: 'bg-amber-400' },
  paid:      { label: 'Paid',      cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-400' },
}

function StatusBadge({ status }: { status: PayrollStatus }) {
  const { label, cls, dot } = STATUS_CFG[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium border ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  )
}

const PIPELINE: PayrollStatus[] = ['draft', 'processed', 'approved', 'paid']

function StatusPipeline({ current }: { current: PayrollStatus }) {
  const idx = PIPELINE.indexOf(current)
  return (
    <div className="flex items-center gap-0">
      {PIPELINE.map((s, i) => {
        const done = i < idx
        const active = i === idx
        const cfg = STATUS_CFG[s]
        return (
          <div key={s} className="flex items-center">
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              active ? `border ${cfg.cls}` : done ? 'text-slate-600' : 'text-slate-700'
            }`}>
              {done && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3 text-slate-600"><polyline points="20 6 9 17 4 12" /></svg>}
              {active && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />}
              {cfg.label}
            </div>
            {i < PIPELINE.length - 1 && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4 text-slate-700 shrink-0">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Action button for run state machine ──────────────────────────────────────

function RunActionButton({
  run,
  onAction,
  loading,
}: {
  run: IPayrollRun
  onAction: (action: 'process' | 'approve' | 'paid', id: string) => void
  loading: boolean
}) {
  if (run.status === 'draft') {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onAction('process', run.id) }}
        disabled={loading}
        className="px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600/30 text-xs font-medium transition-all disabled:opacity-40"
      >
        Process
      </button>
    )
  }
  if (run.status === 'processed') {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onAction('approve', run.id) }}
        disabled={loading}
        className="px-3 py-1.5 rounded-lg bg-amber-600/20 border border-amber-500/30 text-amber-400 hover:bg-amber-600/30 text-xs font-medium transition-all disabled:opacity-40"
      >
        Approve
      </button>
    )
  }
  if (run.status === 'approved') {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onAction('paid', run.id) }}
        disabled={loading}
        className="px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 text-xs font-medium transition-all disabled:opacity-40"
      >
        Mark Paid
      </button>
    )
  }
  return <span className="text-slate-600 text-xs">—</span>
}

// ─── Create Run Modal ─────────────────────────────────────────────────────────

function CreateRunModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleCreate() {
    setSaving(true)
    setErr('')
    try {
      await createPayrollRun({ period_year: year, period_month: month, notes: notes || undefined })
      onCreated()
      onClose()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
      setErr(msg ?? 'Failed to create payroll run.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800/60 rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-slate-100 font-semibold">New Payroll Run</h2>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Year</label>
                <input
                  type="number"
                  value={year}
                  min={2000}
                  max={2100}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-indigo-500/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Month</label>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-indigo-500/50"
                >
                  {MONTH_NAMES.slice(1).map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Regular monthly run"
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-indigo-500/50 resize-none"
              />
            </div>

            {err && <p className="text-rose-400 text-sm">{err}</p>}

            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-slate-700/50 text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {saving ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Run detail panel ─────────────────────────────────────────────────────────

function RunDetailPanel({
  run,
  onClose,
  onAction,
  actionLoading,
}: {
  run: IPayrollRunDetail
  onClose: () => void
  onAction: (action: 'process' | 'approve' | 'paid', id: string) => void
  actionLoading: boolean
}) {
  const [downloading, setDownloading] = useState<string | null>(null)

  async function handleDownload(entry: IPayrollEntry) {
    setDownloading(entry.id)
    try {
      const empName = (entry.employee?.full_name ?? 'employee').replace(/\s+/g, '_')
      const filename = `payslip_${empName}_${entry.period_year}_${MONTH_ABBR[entry.period_month]}.pdf`
      await downloadPayslip(entry.payroll_run_id, entry.id, filename)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-4xl bg-slate-900 border-l border-slate-800/60 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800/60 shrink-0">
          <div>
            <h2 className="text-slate-100 font-semibold text-lg">
              {periodLabel(run.period_year, run.period_month)} — Revision {run.revision}
            </h2>
            <div className="flex items-center gap-3 mt-1.5">
              <StatusBadge status={run.status} />
              <span className="text-slate-600 text-xs">{run.entry_count} employees</span>
              {run.processed_at && <span className="text-slate-600 text-xs">Processed {fmtDate(run.processed_at)}</span>}
              {run.approved_at  && <span className="text-slate-600 text-xs">Approved {fmtDate(run.approved_at)}</span>}
              {run.paid_at      && <span className="text-slate-600 text-xs">Paid {fmtDate(run.paid_at)}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <RunActionButton run={run} onAction={onAction} loading={actionLoading} />
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Summary bar */}
        {run.entry_count > 0 && (
          <div className="flex items-center gap-6 px-6 py-3 bg-slate-800/30 border-b border-slate-800/40 shrink-0 text-sm">
            <div>
              <span className="text-slate-500 text-xs">Total Gross</span>
              <p className="text-slate-200 font-semibold tabular-nums">{fmtCurrency(run.total_gross)}</p>
            </div>
            <div className="h-8 w-px bg-slate-700/50" />
            <div>
              <span className="text-slate-500 text-xs">Total Net</span>
              <p className="text-emerald-400 font-semibold tabular-nums">{fmtCurrency(run.total_net)}</p>
            </div>
            <div className="h-8 w-px bg-slate-700/50" />
            <div>
              <span className="text-slate-500 text-xs">Total Deductions</span>
              <p className="text-rose-400 font-semibold tabular-nums">
                {fmtCurrency(parseFloat(run.total_gross) - parseFloat(run.total_net))}
              </p>
            </div>
          </div>
        )}

        {/* Entries table */}
        <div className="flex-1 overflow-y-auto">
          {run.entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-600">
              <p className="text-sm">No entries yet — click Process to compute salaries.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800/40">
                <tr>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Employee</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Days</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Gross</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Deductions</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Net</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {run.entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-slate-200 font-medium text-sm">{entry.employee?.full_name ?? '—'}</p>
                      <p className="text-slate-500 text-xs">{entry.employee?.email ?? entry.employee_id?.slice(0, 8) ?? '—'}</p>
                      {entry.employee?.job_title && (
                        <p className="text-slate-600 text-xs">{entry.employee.job_title}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-medium text-slate-400 bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700/50">
                        {entry.employee_type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-300 text-sm tabular-nums">
                      <span className="font-medium">{entry.days_present}</span>
                      <span className="text-slate-600">/{entry.working_days}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-200 text-sm font-medium tabular-nums">
                      {fmtCurrency(entry.gross_salary)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-rose-400 text-sm tabular-nums">
                      -{fmtCurrency(entry.total_deductions)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-emerald-400 text-sm font-semibold tabular-nums">
                      {fmtCurrency(entry.net_salary)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {run.status !== 'draft' && (
                        <button
                          onClick={() => handleDownload(entry)}
                          disabled={downloading === entry.id}
                          className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-40 ml-auto"
                        >
                          {downloading === entry.id ? (
                            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30" strokeLinecap="round" /></svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                          )}
                          PDF
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Deduction breakdown legend */}
        {run.entries.length > 0 && Object.keys(run.entries[0].deduction_breakdown).length > 0 && (
          <div className="px-6 py-3 border-t border-slate-800/40 shrink-0">
            <p className="text-slate-600 text-xs">
              Deductions:&nbsp;
              {Object.entries(run.entries[0].deduction_breakdown).map(([code, amt], i) => (
                <span key={code}>
                  {i > 0 && ' · '}
                  <span className="text-slate-500">{code} = {fmtCurrency(amt)}</span>
                </span>
              ))}
              &nbsp;(sample — first employee)
            </p>
          </div>
        )}
      </div>
    </>
  )
}

// ─── HR: Payroll Runs tab ─────────────────────────────────────────────────────

function RunsTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [runs, setRuns] = useState<IPayrollRun[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [detailRun, setDetailRun] = useState<IPayrollRunDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchRuns = useCallback(async (pg = 1) => {
    setLoading(true)
    try {
      const res = await listPayrollRuns(pg)
      setRuns(res.items)
      setTotal(res.total)
      setPage(pg)
      setPages(res.pages)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRuns() }, [fetchRuns])

  async function openDetail(run: IPayrollRun) {
    setDetailLoading(true)
    try {
      const detail = await getPayrollRun(run.id)
      setDetailRun(detail)
    } catch {
      showToast('Failed to load run detail', 'error')
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleAction(action: 'process' | 'approve' | 'paid', id: string) {
    setActionLoading(true)
    try {
      if (action === 'process') await processRun(id)
      else if (action === 'approve') await approveRun(id)
      else await markPaid(id)
      showToast(`Run ${action === 'paid' ? 'marked as paid' : action + 'd'} successfully`)
      await fetchRuns(page)
      // refresh detail panel if open
      if (detailRun?.id === id) {
        const refreshed = await getPayrollRun(id)
        setDetailRun(refreshed)
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
      showToast(msg ?? 'Action failed', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-sm">{total} run{total !== 1 ? 's' : ''} total</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Run
        </button>
      </div>

      {/* Runs table */}
      <div className="rounded-2xl border border-slate-800/60 bg-slate-800/10 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-600 text-sm">Loading…</div>
        ) : runs.length === 0 ? (
          <div className="p-12 text-center text-slate-600 text-sm">
            No payroll runs yet. Click <span className="text-indigo-400">New Run</span> to get started.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800/40">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Period</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Pipeline</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Notes</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Created</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {runs.map((run) => (
                <tr
                  key={run.id}
                  onClick={() => openDetail(run)}
                  className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-4">
                    <p className="text-slate-200 font-semibold">{periodLabel(run.period_year, run.period_month)}</p>
                    <p className="text-slate-600 text-xs mt-0.5">Rev. {run.revision}</p>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell">
                    <StatusPipeline current={run.status} />
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell">
                    <p className="text-slate-500 text-sm truncate max-w-xs">{run.notes ?? '—'}</p>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell">
                    <p className="text-slate-500 text-sm">{fmtDate(run.created_at)}</p>
                  </td>
                  <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <RunActionButton run={run} onAction={handleAction} loading={actionLoading} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-slate-500 text-sm">{total} runs · page {page} of {pages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => fetchRuns(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-slate-700/50 text-slate-400 hover:text-slate-200 disabled:opacity-30 text-sm transition-colors"
            >
              ← Prev
            </button>
            <button
              onClick={() => fetchRuns(page + 1)}
              disabled={page >= pages}
              className="px-3 py-1.5 rounded-lg border border-slate-700/50 text-slate-400 hover:text-slate-200 disabled:opacity-30 text-sm transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateRunModal
          onClose={() => setShowCreate(false)}
          onCreated={() => fetchRuns(1)}
        />
      )}

      {detailLoading && !detailRun && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/50 z-50">
          <div className="text-slate-400 text-sm">Loading run details…</div>
        </div>
      )}

      {detailRun && (
        <RunDetailPanel
          run={detailRun}
          onClose={() => setDetailRun(null)}
          onAction={handleAction}
          actionLoading={actionLoading}
        />
      )}
    </div>
  )
}

// ─── HR: Deduction Rules tab ──────────────────────────────────────────────────

type RuleForm = {
  name: string
  code: string
  description: string
  type: 'percentage' | 'fixed'
  value: string
  applies_to: string
  is_statutory: boolean
}

const BLANK_RULE: RuleForm = {
  name: '', code: '', description: '', type: 'percentage', value: '', applies_to: 'all', is_statutory: false,
}

function DeductionRulesTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [rules, setRules] = useState<IDeductionRule[]>([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editRule, setEditRule] = useState<IDeductionRule | null>(null)
  const [form, setForm] = useState<RuleForm>(BLANK_RULE)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const fetchRules = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listDeductionRules(true)
      setRules(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRules() }, [fetchRules])

  function openAdd() {
    setForm(BLANK_RULE)
    setErr('')
    setEditRule(null)
    setShowAdd(true)
  }

  function openEdit(rule: IDeductionRule) {
    setForm({
      name: rule.name,
      code: rule.code,
      description: rule.description ?? '',
      type: rule.type,
      value: rule.value,
      applies_to: rule.applies_to,
      is_statutory: rule.is_statutory,
    })
    setErr('')
    setEditRule(rule)
    setShowAdd(true)
  }

  async function handleSave() {
    if (!form.name || !form.code || !form.value) return
    setSaving(true)
    setErr('')
    try {
      if (editRule) {
        await updateDeductionRule(editRule.id, {
          name: form.name,
          description: form.description || undefined,
          value: parseFloat(form.value),
          applies_to: form.applies_to,
        })
        showToast('Deduction rule updated')
      } else {
        await createDeductionRule({
          name: form.name,
          code: form.code,
          description: form.description || undefined,
          type: form.type,
          value: parseFloat(form.value),
          applies_to: form.applies_to,
          is_statutory: form.is_statutory,
        })
        showToast('Deduction rule created')
      }
      setShowAdd(false)
      fetchRules()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
      setErr(msg ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(rule: IDeductionRule) {
    try {
      if (rule.is_active) {
        await deactivateDeductionRule(rule.id)
        showToast(`${rule.name} deactivated`)
      } else {
        await updateDeductionRule(rule.id, { is_active: true })
        showToast(`${rule.name} activated`)
      }
      fetchRules()
    } catch {
      showToast('Failed to toggle rule', 'error')
    }
  }

  const formField = (label: string, node: React.ReactNode) => (
    <div className="space-y-1.5">
      <label className="text-slate-400 text-xs font-semibold uppercase tracking-wide">{label}</label>
      {node}
    </div>
  )

  const input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      {...props}
      className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-indigo-500/50 placeholder:text-slate-600"
    />
  )

  const select = (props: React.SelectHTMLAttributes<HTMLSelectElement>, children: React.ReactNode) => (
    <select
      {...props}
      className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-indigo-500/50"
    >
      {children}
    </select>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-sm">{rules.filter(r => r.is_active).length} active · {rules.length} total</p>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Rule
        </button>
      </div>

      <div className="rounded-2xl border border-slate-800/60 bg-slate-800/10 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-600 text-sm">Loading…</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800/40">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Code</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Value</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Applies To</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Statutory</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="text-xs font-mono font-semibold text-slate-300 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/50">
                      {rule.code}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-slate-200 text-sm font-medium">{rule.name}</p>
                    {rule.description && <p className="text-slate-600 text-xs truncate max-w-48">{rule.description}</p>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${
                      rule.type === 'percentage'
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                    }`}>
                      {rule.type === 'percentage' ? '%' : '₹'} {rule.type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right text-slate-200 text-sm font-medium tabular-nums">
                    {rule.type === 'percentage' ? `${parseFloat(rule.value)}%` : fmtCurrency(rule.value)}
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <span className="text-slate-400 text-xs">{rule.applies_to}</span>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    {rule.is_statutory
                      ? <span className="text-xs text-amber-400 font-medium">Statutory</span>
                      : <span className="text-slate-600 text-xs">—</span>
                    }
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium ${rule.is_active ? 'text-emerald-400' : 'text-slate-600'}`}>
                      {rule.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center gap-3 justify-end">
                      <button
                        onClick={() => openEdit(rule)}
                        className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggle(rule)}
                        className={`text-xs transition-colors ${
                          rule.is_active ? 'text-slate-500 hover:text-rose-400' : 'text-slate-600 hover:text-emerald-400'
                        }`}
                      >
                        {rule.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-600 text-sm">
                    No deduction rules yet. Add one to start calculating deductions.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Drawer */}
      {showAdd && (
        <>
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40" onClick={() => setShowAdd(false)} />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-slate-900 border-l border-slate-800/60 z-50 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800/60 shrink-0">
              <div>
                <h2 className="text-slate-100 font-semibold">{editRule ? 'Edit Deduction Rule' : 'New Deduction Rule'}</h2>
                <p className="text-slate-500 text-xs mt-0.5">{editRule ? `Code: ${editRule.code}` : 'Configure how deductions are calculated'}</p>
              </div>
              <button onClick={() => setShowAdd(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {formField('Name', input({ value: form.name, onChange: (e) => setForm(f => ({ ...f, name: e.target.value })), placeholder: 'e.g. Provident Fund' }))}
              {formField('Code', input({
                value: form.code,
                onChange: (e) => setForm(f => ({ ...f, code: e.target.value.toUpperCase() })),
                placeholder: 'e.g. PF',
                disabled: !!editRule,
                className: `w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-indigo-500/50 placeholder:text-slate-600 uppercase ${editRule ? 'opacity-50 cursor-not-allowed' : ''}`,
              }))}
              {formField('Description', input({ value: form.description, onChange: (e) => setForm(f => ({ ...f, description: e.target.value })), placeholder: 'Optional description' }))}

              {!editRule && formField('Type', select(
                { value: form.type, onChange: (e) => setForm(f => ({ ...f, type: e.target.value as 'percentage' | 'fixed' })) },
                <>
                  <option value="percentage">Percentage of gross (%)</option>
                  <option value="fixed">Fixed amount (₹)</option>
                </>
              ))}

              {formField(
                form.type === 'percentage' ? 'Rate (%)' : 'Amount (₹)',
                input({
                  type: 'number',
                  step: '0.01',
                  min: '0',
                  value: form.value,
                  onChange: (e) => setForm(f => ({ ...f, value: e.target.value })),
                  placeholder: form.type === 'percentage' ? 'e.g. 12' : 'e.g. 500',
                })
              )}

              {formField('Applies To', select(
                { value: form.applies_to, onChange: (e) => setForm(f => ({ ...f, applies_to: e.target.value })) },
                <>
                  <option value="all">All employees</option>
                  <option value="FULL_TIME">Full-time only</option>
                  <option value="HOURLY">Hourly only</option>
                  <option value="CONTRACT">Contract only</option>
                </>
              ))}

              {!editRule && (
                <div className="flex items-center gap-3 py-1">
                  <button
                    onClick={() => setForm(f => ({ ...f, is_statutory: !f.is_statutory }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${form.is_statutory ? 'bg-amber-500' : 'bg-slate-700'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${form.is_statutory ? 'translate-x-5' : ''}`} />
                  </button>
                  <span className="text-slate-300 text-sm">Statutory deduction (EPF, ESI, TDS)</span>
                </div>
              )}

              {err && <p className="text-rose-400 text-sm">{err}</p>}
            </div>

            <div className="px-6 py-5 border-t border-slate-800/60 flex gap-3 shrink-0">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700/50 text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.code || !form.value}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-40"
              >
                {saving ? 'Saving…' : editRule ? 'Save Changes' : 'Create Rule'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Employee: My Payslips tab ────────────────────────────────────────────────

function MyPayslipsTab() {
  const [entries, setEntries] = useState<IPayrollEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)

  const fetchEntries = useCallback(async (pg = 1) => {
    setLoading(true)
    try {
      const res = await myPayrollEntries(pg)
      setEntries(res.items)
      setTotal(res.total)
      setPage(pg)
      setPages(res.pages)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  async function handleDownload(entry: IPayrollEntry) {
    setDownloading(entry.id)
    try {
      const empName = (entry.employee?.full_name ?? 'my').replace(/\s+/g, '_')
      const filename = `payslip_${empName}_${entry.period_year}_${MONTH_ABBR[entry.period_month]}.pdf`
      await downloadPayslip(entry.payroll_run_id, entry.id, filename)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-800/60 bg-slate-800/10 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-600 text-sm">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 mb-3 opacity-40">
              <rect x="2" y="3" width="20" height="18" rx="2" />
              <line x1="7" y1="8" x2="17" y2="8" />
              <line x1="7" y1="12" x2="17" y2="12" />
              <line x1="7" y1="16" x2="12" y2="16" />
            </svg>
            <p className="text-sm">No payslips available yet.</p>
            <p className="text-xs mt-1 text-slate-700">Your HR will process payroll at end of each month.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800/40">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Period</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Type</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Days</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Gross</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Deductions</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Net Pay</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-5 py-4">
                    <p className="text-slate-200 font-semibold">{periodLabel(entry.period_year, entry.period_month)}</p>
                    <p className="text-slate-600 text-xs mt-0.5">{entry.period_year}</p>
                  </td>
                  <td className="px-5 py-4 hidden sm:table-cell">
                    <span className="text-xs text-slate-400 bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700/50">
                      {entry.employee_type}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right hidden md:table-cell">
                    <span className="text-slate-300 text-sm tabular-nums font-medium">{entry.days_present}</span>
                    <span className="text-slate-600 text-xs">/{entry.working_days}</span>
                  </td>
                  <td className="px-5 py-4 text-right text-slate-200 text-sm font-medium tabular-nums">
                    {fmtCurrency(entry.gross_salary)}
                  </td>
                  <td className="px-5 py-4 text-right text-rose-400 text-sm tabular-nums">
                    -{fmtCurrency(entry.total_deductions)}
                  </td>
                  <td className="px-5 py-4 text-right text-emerald-400 text-sm font-bold tabular-nums">
                    {fmtCurrency(entry.net_salary)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => handleDownload(entry)}
                      disabled={downloading === entry.id}
                      className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-40 ml-auto"
                    >
                      {downloading === entry.id ? (
                        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30" strokeLinecap="round" /></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      )}
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-slate-500 text-sm">{total} payslips · page {page} of {pages}</p>
          <div className="flex gap-2">
            <button onClick={() => fetchEntries(page - 1)} disabled={page <= 1} className="px-3 py-1.5 rounded-lg border border-slate-700/50 text-slate-400 hover:text-slate-200 disabled:opacity-30 text-sm transition-colors">← Prev</button>
            <button onClick={() => fetchEntries(page + 1)} disabled={page >= pages} className="px-3 py-1.5 rounded-lg border border-slate-700/50 text-slate-400 hover:text-slate-200 disabled:opacity-30 text-sm transition-colors">Next →</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Payroll() {
  const { user } = useAuthStore()
  const role = user?.role ?? 'employee'
  const isHR = role === 'super_admin' || role === 'hr_admin'

  const tabs = isHR
    ? [
        { id: 'runs', label: 'Payroll Runs' },
        { id: 'rules', label: 'Deduction Rules' },
      ]
    : [{ id: 'payslips', label: 'My Payslips' }]

  const [tab, setTab] = useState(tabs[0].id)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
  }, [])

  return (
    <Layout title="Payroll">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-slate-100 text-2xl font-bold">Payroll</h1>
          <p className="text-slate-500 text-sm mt-1">
            {isHR ? 'Manage payroll runs, approve salaries, configure deductions.' : 'View your monthly payslips and salary breakdowns.'}
          </p>
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 border-b border-slate-800/60 pb-0">
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

        {/* Tab content */}
        {tab === 'runs'     && <RunsTab showToast={showToast} />}
        {tab === 'rules'    && <DeductionRulesTab showToast={showToast} />}
        {tab === 'payslips' && <MyPayslipsTab />}
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />
      )}
    </Layout>
  )
}

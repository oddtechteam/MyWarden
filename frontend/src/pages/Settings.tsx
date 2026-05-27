import { useState } from 'react'
import Layout from '@/components/app/Layout'
import { useAuthStore } from '@/store/authStore'
import { getEmailSettings, setEmailPaused } from '@/api/admin'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'

// ─── When emails fire reference ───────────────────────────────────────────────

const EMAIL_TRIGGERS = [
  {
    event: 'Payroll processed',
    description: 'When HR clicks "Process" on a payroll run (DRAFT → PROCESSED)',
    recipients: 'Every employee in that payroll run',
    content: 'Gross salary, net salary, message to download payslip',
    color: 'indigo',
  },
  {
    event: 'Payroll paid',
    description: 'When HR clicks "Mark as Paid" on a payroll run (APPROVED → PAID)',
    recipients: 'Every employee in that payroll run',
    content: 'Net salary credited confirmation',
    color: 'emerald',
  },
  {
    event: 'Leave approved',
    description: 'When a manager or HR approves a leave request',
    recipients: 'The employee who submitted the request',
    content: 'Leave type, dates, duration, reviewer note (if any)',
    color: 'blue',
  },
  {
    event: 'Leave rejected',
    description: 'When a manager or HR rejects a leave request',
    recipients: 'The employee who submitted the request',
    content: 'Leave type, dates, reason/note (if any)',
    color: 'rose',
  },
]

const COLOR_MAP: Record<string, { dot: string; bg: string; text: string }> = {
  indigo:  { dot: 'bg-indigo-400',  bg: 'bg-indigo-500/10',  text: 'text-indigo-400'  },
  emerald: { dot: 'bg-emerald-400', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  blue:    { dot: 'bg-blue-400',    bg: 'bg-blue-500/10',    text: 'text-blue-400'    },
  rose:    { dot: 'bg-rose-400',    bg: 'bg-rose-500/10',    text: 'text-rose-400'    },
}

// ─── Email toggle card ────────────────────────────────────────────────────────

function EmailToggleCard() {
  const qc = useQueryClient()
  const [optimisticPaused, setOptimisticPaused] = useState<boolean | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['emailSettings'],
    queryFn: getEmailSettings,
    refetchOnWindowFocus: false,
  })

  const mutation = useMutation({
    mutationFn: (paused: boolean) => setEmailPaused(paused),
    onMutate: (paused) => setOptimisticPaused(paused),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emailSettings'] })
      setOptimisticPaused(null)
    },
    onError: () => setOptimisticPaused(null),
  })

  const paused  = optimisticPaused ?? data?.paused ?? false
  const configured = data?.smtp_configured ?? false

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2.5 mb-1">
            <h3 className="text-slate-200 font-semibold">Email notifications</h3>
            {isLoading ? (
              <span className="text-slate-600 text-xs">loading…</span>
            ) : configured ? (
              paused ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Paused
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700/60 text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                SMTP not configured
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm leading-relaxed">
            {configured
              ? paused
                ? 'All outgoing email notifications are currently paused. No emails will be sent until you resume.'
                : 'Email notifications are active. Employees receive emails when payroll is processed, paid, or leave status changes.'
              : 'SMTP is not configured. Set SMTP_ENABLED=true and fill in the SMTP_* variables in your .env to enable emails.'}
          </p>
        </div>

        {/* Toggle button */}
        <button
          onClick={() => mutation.mutate(!paused)}
          disabled={mutation.isPending || isLoading || !configured}
          className={`shrink-0 relative inline-flex h-7 w-13 items-center rounded-full transition-colors duration-300 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
            !paused ? 'bg-emerald-600' : 'bg-slate-700'
          }`}
          style={{ width: '52px' }}
          title={paused ? 'Resume notifications' : 'Pause notifications'}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-300 ${
              !paused ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {configured && (
        <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
          <p className="text-slate-600 text-xs">
            {paused ? 'Click the toggle to resume sending emails.' : 'Click the toggle to pause all outgoing emails.'}
          </p>
          {mutation.isPending && (
            <span className="text-slate-500 text-xs animate-pulse">Saving…</span>
          )}
          {mutation.isSuccess && !mutation.isPending && (
            <span className="text-emerald-400 text-xs">
              {paused ? 'Paused' : 'Resumed'} ✓
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Settings() {
  const { user } = useAuthStore()

  if (user?.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <Layout title="Settings">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* ── Notification settings ── */}
        <section>
          <div className="mb-4">
            <h2 className="text-slate-200 font-semibold text-base">Notification settings</h2>
            <p className="text-slate-500 text-sm mt-0.5">Control when and whether the system sends automated emails.</p>
          </div>
          <EmailToggleCard />
        </section>

        {/* ── When emails fire ── */}
        <section>
          <div className="mb-4">
            <h2 className="text-slate-200 font-semibold text-base">When emails are sent</h2>
            <p className="text-slate-500 text-sm mt-0.5">
              Emails are dispatched automatically as a background job — they do not block the action that triggered them.
            </p>
          </div>

          <div className="space-y-3">
            {EMAIL_TRIGGERS.map((t) => {
              const c = COLOR_MAP[t.color]
              return (
                <div key={t.event} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <div className="flex items-start gap-4">
                    <div className={`mt-0.5 w-2 h-2 rounded-full ${c.dot} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-slate-100 font-medium text-sm">{t.event}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${c.bg} ${c.text}`}>
                          automatic
                        </span>
                      </div>
                      <p className="text-slate-500 text-sm mb-2">{t.description}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="bg-slate-800/50 rounded-lg px-3 py-2">
                          <p className="text-slate-600 text-xs mb-0.5">Recipients</p>
                          <p className="text-slate-300 text-xs font-medium">{t.recipients}</p>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg px-3 py-2">
                          <p className="text-slate-600 text-xs mb-0.5">Email contains</p>
                          <p className="text-slate-300 text-xs font-medium">{t.content}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Setup reminder ── */}
        <section className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5">
          <h3 className="text-slate-300 font-medium text-sm mb-3 flex items-center gap-2">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-amber-400">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            SMTP setup required to activate emails
          </h3>
          <div className="space-y-1.5 text-slate-500 text-xs font-mono">
            <p>SMTP_ENABLED=<span className="text-emerald-400">true</span></p>
            <p>SMTP_HOST=<span className="text-slate-400">smtp.gmail.com</span></p>
            <p>SMTP_PORT=<span className="text-slate-400">587</span></p>
            <p>SMTP_TLS=<span className="text-emerald-400">true</span></p>
            <p>SMTP_USER=<span className="text-slate-400">your-email@gmail.com</span></p>
            <p>SMTP_PASSWORD=<span className="text-slate-400">your-app-password</span></p>
            <p>SMTP_FROM=<span className="text-slate-400">MyWarden &lt;no-reply@company.com&gt;</span></p>
          </div>
          <p className="text-slate-600 text-xs mt-3">
            For Gmail, generate an <strong className="text-slate-500">App Password</strong> (not your login password) at myaccount.google.com → Security → 2-Step Verification → App passwords.
          </p>
        </section>

      </div>
    </Layout>
  )
}

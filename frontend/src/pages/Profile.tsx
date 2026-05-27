import { useState } from 'react'
import Layout from '@/components/app/Layout'
import { getMyProfile, updateMyProfile } from '@/api/employees'
import { changePassword } from '@/api/auth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { IEmployee } from '@/types/employee'

// ─── Info row ────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-800/60 last:border-0">
      <span className="text-slate-500 text-sm shrink-0">{label}</span>
      <span className="text-slate-300 text-sm text-right">
        {value ?? <span className="text-slate-600 italic">Not set</span>}
      </span>
    </div>
  )
}

// ─── Profile completion ───────────────────────────────────────────────────────

function ProfileCompletion({ employee }: { employee: IEmployee }) {
  const checks = [
    { label: 'Full name set',       done: !!employee.full_name },
    { label: 'Phone number added',  done: !!employee.phone },
    { label: 'Job title assigned',  done: !!employee.job_title },
    { label: 'Department assigned', done: !!employee.department_id },
    { label: 'Face enrolled',       done: employee.face_enrolled },
  ]
  const done  = checks.filter((c) => c.done).length
  const pct   = Math.round((done / checks.length) * 100)
  const color = pct === 100 ? '#059669' : pct >= 60 ? '#6366f1' : '#f59e0b'

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-slate-200 font-semibold text-sm">Profile completion</h3>
        <span className="text-xs font-semibold" style={{ color }}>{pct}%</span>
      </div>

      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-5">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>

      <ul className="space-y-2.5">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center gap-2.5 text-sm">
            {c.done ? (
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-emerald-500 shrink-0">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-slate-700 shrink-0">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
            )}
            <span className={c.done ? 'text-slate-300' : 'text-slate-600'}>{c.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Edit profile form ────────────────────────────────────────────────────────

function EditProfileForm({ employee }: { employee: IEmployee }) {
  const qc = useQueryClient()
  const [fullName, setFullName] = useState(employee.full_name ?? '')
  const [phone,    setPhone]    = useState(employee.phone ?? '')
  const [success,  setSuccess]  = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      updateMyProfile({
        full_name: fullName.trim() || undefined,
        phone:     phone.trim()    || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myProfile'] })
      setSuccess('Saved')
      setTimeout(() => setSuccess(''), 3000)
    },
  })

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h3 className="text-slate-200 font-semibold mb-5">Edit profile</h3>

      <div className="space-y-4">
        <Field label="Full name">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors"
          />
        </Field>

        <Field label="Phone">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors"
          />
        </Field>

        {mutation.isError && (
          <p className="text-red-400 text-sm">
            {(mutation.error as any)?.response?.data?.detail ?? 'Failed to update profile'}
          </p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {mutation.isPending ? 'Saving…' : 'Save changes'}
          </button>
          {success && <span className="text-emerald-400 text-sm">{success}</span>}
        </div>
      </div>
    </div>
  )
}

// ─── Change password form ─────────────────────────────────────────────────────

function ChangePasswordForm() {
  const [current, setCurrent]   = useState('')
  const [next,    setNext]      = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error,   setError]     = useState('')
  const [success, setSuccess]   = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (next !== confirm)   { setError('New passwords do not match'); return }
    if (next.length < 8)    { setError('Must be at least 8 characters'); return }
    setLoading(true)
    try {
      await changePassword(current, next)
      setSuccess('Password changed')
      setCurrent(''); setNext(''); setConfirm('')
      setTimeout(() => setSuccess(''), 4000)
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h3 className="text-slate-200 font-semibold mb-5">Change password</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Current password">
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors"
          />
        </Field>

        <Field label="New password">
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors"
          />
        </Field>

        <Field label="Confirm new password">
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors"
          />
        </Field>

        {error   && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {loading ? 'Changing…' : 'Change password'}
          </button>
          {success && <span className="text-emerald-400 text-sm">{success}</span>}
        </div>
      </form>
    </div>
  )
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Profile() {
  const { data: employee, isLoading } = useQuery({
    queryKey: ['myProfile'],
    queryFn:  getMyProfile,
  })

  if (isLoading) {
    return (
      <Layout title="My Profile">
        <div className="flex items-center justify-center py-32">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    )
  }

  if (!employee) return <Layout title="My Profile"><p className="text-slate-500">Could not load profile.</p></Layout>

  const initials = employee.full_name
    ? employee.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : employee.email[0].toUpperCase()

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : null

  return (
    <Layout title="My Profile">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* ── Left column ── */}
          <div className="space-y-5">

            {/* Avatar card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-2xl font-bold mb-4 shadow-lg shadow-indigo-500/20 select-none">
                {initials}
              </div>

              <p className="text-slate-100 font-semibold text-lg leading-snug">
                {employee.full_name ?? <span className="text-slate-500 italic font-normal">No name set</span>}
              </p>
              <p className="text-slate-400 text-sm mt-0.5 break-all">{employee.email}</p>

              <span className="mt-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-400 capitalize">
                {employee.role.replace(/_/g, ' ')}
              </span>
            </div>

            {/* Details card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3">Account details</h3>
              <InfoRow label="Job title"      value={employee.job_title} />
              <InfoRow label="Department"     value={employee.department?.name} />
              <InfoRow label="Employee type"  value={employee.employee_type.replace(/_/g, ' ')} />
              <InfoRow label="Phone"          value={employee.phone} />
              <InfoRow label="Joined"         value={fmtDate(employee.join_date)} />
              <InfoRow
                label="Face enrolled"
                value={
                  <span className={employee.face_enrolled ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
                    {employee.face_enrolled ? 'Yes' : 'Pending'}
                  </span>
                }
              />
            </div>

            <ProfileCompletion employee={employee} />
          </div>

          {/* ── Right column ── */}
          <div className="lg:col-span-2 space-y-5">
            <EditProfileForm employee={employee} />
            <ChangePasswordForm />
          </div>

        </div>
      </div>
    </Layout>
  )
}

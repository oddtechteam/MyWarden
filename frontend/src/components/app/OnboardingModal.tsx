import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { getMyProfile, updateMyProfile } from '@/api/employees'
import { changePassword } from '@/api/auth'
import { useQuery, useQueryClient } from '@tanstack/react-query'

const STORAGE_KEY = (id: string) => `mywarden_onboarded_${id}`

// ─── Step indicator ───────────────────────────────────────────────────────────

function Steps({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full transition-all duration-300 ${
            i < current
              ? 'bg-indigo-500 w-6'
              : i === current
              ? 'bg-indigo-400 w-8'
              : 'bg-slate-700 w-4'
          }`}
        />
      ))}
    </div>
  )
}

// ─── Step 0: Welcome ─────────────────────────────────────────────────────────

function StepWelcome({ name, onNext }: { name: string; onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center px-2">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mb-5 shadow-lg shadow-indigo-500/25">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-8 h-8">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      </div>
      <h2 className="text-slate-100 font-bold text-xl mb-2">Welcome to MyWarden!</h2>
      <p className="text-slate-400 text-sm leading-relaxed mb-1">
        Hi <span className="text-slate-200 font-medium">{name}</span>, your account is ready.
      </p>
      <p className="text-slate-500 text-sm leading-relaxed mb-8">
        Let's take 2 minutes to complete your setup so everything works perfectly.
      </p>

      <div className="w-full space-y-2.5 mb-8 text-left">
        {[
          { icon: '👤', label: 'Complete your profile', sub: 'Add your phone number' },
          { icon: '🔒', label: 'Secure your account', sub: 'Change your temporary password' },
          { icon: '✅', label: "You're all set!", sub: 'Start using MyWarden' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3 bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-800">
            <span className="text-lg w-6 text-center shrink-0">{item.icon}</span>
            <div>
              <p className="text-slate-200 text-sm font-medium">{item.label}</p>
              <p className="text-slate-500 text-xs">{item.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all shadow-lg shadow-indigo-500/20"
      >
        Get started
      </button>
    </div>
  )
}

// ─── Step 1: Complete profile ─────────────────────────────────────────────────

function StepProfile({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const qc = useQueryClient()
  const { data: employee } = useQuery({ queryKey: ['myProfile'], queryFn: getMyProfile })
  const [phone, setPhone] = useState(employee?.phone ?? '')
  const [fullName, setFullName] = useState(employee?.full_name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await updateMyProfile({
        full_name: fullName.trim() || undefined,
        phone: phone.trim() || undefined,
      })
      qc.invalidateQueries({ queryKey: ['myProfile'] })
      onNext()
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-indigo-400">
            <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
          </svg>
        </div>
        <div>
          <h2 className="text-slate-100 font-semibold">Complete your profile</h2>
          <p className="text-slate-500 text-xs mt-0.5">This information is visible to HR and managers.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Full name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
            className="w-full bg-slate-800/60 border border-slate-700/60 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Phone number</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            className="w-full bg-slate-800/60 border border-slate-700/60 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
          />
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={onSkip}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 bg-slate-800 hover:bg-slate-700 transition-colors"
        >
          Skip for now
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 transition-all"
        >
          {saving ? 'Saving…' : 'Save & continue'}
        </button>
      </div>
    </div>
  )
}

// ─── Step 2: Change password ──────────────────────────────────────────────────

function StepPassword({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleChange() {
    setError('')
    if (next !== confirm) { setError('New passwords do not match'); return }
    if (next.length < 8) { setError('Must be at least 8 characters'); return }
    setSaving(true)
    try {
      await changePassword(current, next)
      onNext()
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-slate-800/60 border border-slate-700/60 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all'

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-violet-400">
            <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <h2 className="text-slate-100 font-semibold">Secure your account</h2>
          <p className="text-slate-500 text-xs mt-0.5">Replace your temporary password with something only you know.</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Current (temporary) password</label>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">New password</label>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Min. 8 characters" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirm new password</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
        </div>

        {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={onSkip}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 bg-slate-800 hover:bg-slate-700 transition-colors"
        >
          Skip for now
        </button>
        <button
          onClick={handleChange}
          disabled={saving || !current || !next || !confirm}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 transition-all"
        >
          {saving ? 'Saving…' : 'Change & continue'}
        </button>
      </div>
    </div>
  )
}

// ─── Step 3: All set ──────────────────────────────────────────────────────────

function StepDone({ name, onFinish }: { name: string; onFinish: () => void }) {
  return (
    <div className="flex flex-col items-center text-center px-2">
      <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-5">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-8 h-8 text-emerald-400">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h2 className="text-slate-100 font-bold text-xl mb-2">You're all set, {name}!</h2>
      <p className="text-slate-400 text-sm leading-relaxed mb-7">
        Your account is ready to use. Here's what you can do in MyWarden:
      </p>

      <div className="w-full grid grid-cols-2 gap-2.5 mb-8 text-left">
        {[
          { icon: '🗓', label: 'Check attendance', sub: 'View your logs' },
          { icon: '🌴', label: 'Apply for leave', sub: 'Submit requests' },
          { icon: '💰', label: 'View payslips', sub: 'Download PDFs' },
          { icon: '👤', label: 'My profile', sub: 'Update anytime' },
        ].map((item) => (
          <div key={item.label} className="bg-slate-800/50 rounded-xl px-3 py-3 border border-slate-800">
            <span className="text-base">{item.icon}</span>
            <p className="text-slate-200 text-xs font-medium mt-1.5">{item.label}</p>
            <p className="text-slate-600 text-xs">{item.sub}</p>
          </div>
        ))}
      </div>

      <button
        onClick={onFinish}
        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-500/20"
      >
        Start using MyWarden
      </button>
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function OnboardingModal() {
  const { user } = useAuthStore()
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    const done = localStorage.getItem(STORAGE_KEY(user.id))
    if (!done) setVisible(true)
  }, [user?.id])

  function finish() {
    if (user?.id) localStorage.setItem(STORAGE_KEY(user.id), 'true')
    setVisible(false)
  }

  if (!visible || !user) return null

  const name = user.full_name ?? user.email ?? 'there'
  const TOTAL_STEPS = 4

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md" />

      {/* Card */}
      <div className="relative bg-slate-900 border border-slate-800/60 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-800/60">
          <Steps current={step} total={TOTAL_STEPS} />
          <span className="text-slate-600 text-xs">
            {step + 1} / {TOTAL_STEPS}
          </span>
        </div>

        {/* Step content */}
        <div className="px-6 py-6">
          {step === 0 && (
            <StepWelcome name={name} onNext={() => setStep(1)} />
          )}
          {step === 1 && (
            <StepProfile onNext={() => setStep(2)} onSkip={() => setStep(2)} />
          )}
          {step === 2 && (
            <StepPassword onNext={() => setStep(3)} onSkip={() => setStep(3)} />
          )}
          {step === 3 && (
            <StepDone name={user.full_name ?? user.email ?? 'there'} onFinish={finish} />
          )}
        </div>
      </div>
    </div>
  )
}

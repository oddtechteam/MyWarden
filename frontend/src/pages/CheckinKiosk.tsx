import { useRef, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Webcam from 'react-webcam'
import { verifyKioskAdmin, autoStamp } from '@/api/attendance'
import type { AttendanceStatus, ICheckinResponse } from '@/types/attendance'

// ─── Types ───────────────────────────────────────────────────────────────────

type KioskPhase = 'admin_auth' | 'active'
type ScanPhase = 'idle' | 'processing' | 'success' | 'error'
type StampAction = 'checkin' | 'checkout'
type ErrorKind = 'no_face' | 'not_recognised' | 'already' | 'auth_fail' | 'server'

interface StampResult {
  action: StampAction
  employee_name: string | null
  status: AttendanceStatus
  shift_name: string | null
  timestamp: string
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function dataURLtoBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)![1]
  const binary = atob(b64)
  const arr = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

function parseUTC(iso: string): Date {
  return new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z')
}

function formatIST(iso: string): string {
  return (
    parseUTC(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata',
    }) + ' IST'
  )
}

// ─── Live clock ───────────────────────────────────────────────────────────────

function LiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="text-right tabular-nums">
      <div className="text-slate-100 text-2xl font-light">
        {now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'Asia/Kolkata',
        })}
        <span className="text-slate-500 text-sm font-normal ml-1.5">IST</span>
      </div>
      <div className="text-slate-500 text-sm">
        {now.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          timeZone: 'Asia/Kolkata',
        })}
      </div>
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AttendanceStatus }) {
  const cfg: Record<AttendanceStatus, { label: string; cls: string }> = {
    present:  { label: 'On Time',  cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
    late:     { label: 'Late',     cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
    absent:   { label: 'Absent',   cls: 'bg-rose-500/15 text-rose-400 border-rose-500/25' },
    half_day: { label: 'Half Day', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
  }
  const { label, cls } = cfg[status]
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${cls}`}>
      {label}
    </span>
  )
}

// ─── Result overlays ──────────────────────────────────────────────────────────

function SuccessOverlay({ result, onDismiss }: { result: StampResult; onDismiss: () => void }) {
  const isIn = result.action === 'checkin'
  return (
    <div className="fixed inset-x-0 bottom-0 px-6 pb-6 pt-16 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pointer-events-none">
      <div
        className="max-w-xl mx-auto bg-emerald-950/90 border border-emerald-500/30 rounded-2xl p-6 backdrop-blur-md pointer-events-auto cursor-pointer"
        onClick={onDismiss}
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-6 h-6 text-emerald-400">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <p className="text-emerald-300 font-semibold text-lg truncate">
                {isIn
                  ? `Welcome${result.employee_name ? ', ' + result.employee_name : ''}!`
                  : `Goodbye${result.employee_name ? ', ' + result.employee_name : ''}!`}
              </p>
              {isIn && <StatusBadge status={result.status} />}
            </div>
            <p className="text-emerald-400/60 text-sm">
              {isIn ? 'Checked in' : 'Checked out'} at {formatIST(result.timestamp)}
              {result.shift_name ? ` · ${result.shift_name}` : ''}
            </p>
          </div>
        </div>
        <p className="text-emerald-500/40 text-xs mt-4 text-center">Tap to dismiss</p>
      </div>
    </div>
  )
}

function ErrorOverlay({
  kind,
  message,
  onDismiss,
}: {
  kind: ErrorKind
  message: string
  onDismiss: () => void
}) {
  const colors: Record<ErrorKind, string> = {
    no_face:       'bg-slate-900/90 border-slate-700/50 text-slate-300',
    not_recognised:'bg-orange-950/90 border-orange-500/30 text-orange-300',
    already:       'bg-amber-950/90 border-amber-500/30 text-amber-300',
    auth_fail:     'bg-red-950/90 border-red-500/30 text-red-300',
    server:        'bg-rose-950/90 border-rose-500/30 text-rose-300',
  }
  return (
    <div className="fixed inset-x-0 bottom-0 px-6 pb-6 pt-16 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pointer-events-none">
      <div
        className={`max-w-xl mx-auto border rounded-2xl p-6 backdrop-blur-md pointer-events-auto cursor-pointer ${colors[kind]}`}
        onClick={onDismiss}
      >
        <div className="flex items-start gap-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-6 h-6 opacity-70 shrink-0 mt-0.5">
            <path d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="font-semibold">{message}</p>
        </div>
        <p className="text-xs mt-4 text-center opacity-40">Tap to try again</p>
      </div>
    </div>
  )
}

// ─── Admin Auth Gate ──────────────────────────────────────────────────────────

function AdminAuthGate({
  onSuccess,
}: {
  onSuccess: (token: string, adminName: string) => void
}) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await verifyKioskAdmin(email, password)
      onSuccess(res.kiosk_token, res.admin_name)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setError(e.response?.data?.detail ?? 'Authentication failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#070C14] flex flex-col select-none overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-5 shrink-0 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-5 h-5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <p className="text-slate-100 font-bold text-lg leading-none">MyWarden</p>
            <p className="text-slate-500 text-xs mt-0.5">Attendance Kiosk</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <LiveClock />
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/50 text-slate-400 hover:text-slate-200 hover:border-slate-600 text-sm transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </button>
        </div>
      </div>

      {/* Centered card */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Lock icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/15 border border-indigo-500/25 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-8 h-8 text-indigo-400">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
          </div>

          <h2 className="text-slate-100 text-2xl font-bold text-center mb-1">Unlock Kiosk</h2>
          <p className="text-slate-500 text-sm text-center mb-8">
            Sign in with your Super Admin credentials to activate the attendance kiosk.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-slate-600">
                    <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
                    <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
                  </svg>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@company.com"
                  className="w-full bg-slate-900/80 border border-slate-800 text-slate-100 placeholder-slate-700 rounded-xl pl-11 pr-4 py-3.5 text-sm outline-none transition-all focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/10"
                  required
                  autoFocus
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-slate-600">
                    <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900/80 border border-slate-800 text-slate-100 placeholder-slate-700 rounded-xl pl-11 pr-12 py-3.5 text-sm outline-none transition-all focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/10"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-4 flex items-center text-slate-700 hover:text-slate-400 transition-colors"
                >
                  {showPassword ? (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.091 1.092a4 4 0 00-5.557-5.557z" clipRule="evenodd" />
                      <path d="M10.748 13.93l2.523 2.523a9.987 9.987 0 01-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                      <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 bg-red-500/8 border border-red-500/25 rounded-xl px-4 py-3">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-red-400 shrink-0 mt-0.5">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98] mt-1"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Verifying…
                </span>
              ) : (
                'Unlock Kiosk'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Active kiosk ─────────────────────────────────────────────────────────────

function ActiveKiosk({
  kioskToken,
  adminName,
  onLock,
}: {
  kioskToken: string
  adminName: string
  onLock: () => void
}) {
  const webcamRef = useRef<Webcam>(null)
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle')
  const [result, setResult] = useState<StampResult | null>(null)
  const [errorKind, setErrorKind] = useState<ErrorKind>('server')
  const [errorMsg, setErrorMsg] = useState('')
  const resetRef = useRef<ReturnType<typeof setTimeout>>()

  const scheduleReset = useCallback((ms = 5000) => {
    clearTimeout(resetRef.current)
    resetRef.current = setTimeout(() => {
      setScanPhase('idle')
      setResult(null)
    }, ms)
  }, [])

  const handleDismiss = useCallback(() => {
    clearTimeout(resetRef.current)
    setScanPhase('idle')
    setResult(null)
  }, [])

  useEffect(() => () => clearTimeout(resetRef.current), [])

  async function handleScan() {
    if (scanPhase !== 'idle') return
    const screenshot = webcamRef.current?.getScreenshot()
    if (!screenshot) return

    setScanPhase('processing')
    const blob = dataURLtoBlob(screenshot)

    try {
      const res = await autoStamp(blob, kioskToken)
      const timestamp =
        res.action === 'checkin'
          ? (res as ICheckinResponse).check_in_at ?? new Date().toISOString()
          : (res as ICheckinResponse).check_out_at ?? new Date().toISOString()

      setResult({
        action: res.action,
        employee_name: res.employee_name,
        status: res.status,
        shift_name: res.shift_name,
        timestamp,
      })
      setScanPhase('success')
      scheduleReset(6000)
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { detail?: string } } }
      const status = err.response?.status
      const detail = err.response?.data?.detail ?? 'Something went wrong. Please try again.'

      let kind: ErrorKind = 'server'
      if (status === 422) kind = 'no_face'
      else if (status === 404) kind = 'not_recognised'
      else if (status === 409) kind = 'already'
      else if (status === 401) kind = 'auth_fail'

      setErrorKind(kind)
      setErrorMsg(detail)
      setScanPhase('error')
      scheduleReset(4000)
    }
  }

  const isProcessing = scanPhase === 'processing'

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col select-none overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-5 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-5 h-5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-slate-100 font-bold text-lg leading-none">MyWarden</p>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[10px] font-semibold uppercase tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-0.5">Unlocked by {adminName}</p>
            </div>
          </div>
          <button
            onClick={onLock}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/50 text-slate-400 hover:text-red-400 hover:border-red-500/40 text-sm transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Lock Kiosk
          </button>
        </div>
        <LiveClock />
      </div>

      {/* Camera */}
      <div className="flex-1 flex items-center justify-center px-8 py-2 min-h-0">
        <div
          className="relative w-full max-w-2xl rounded-3xl overflow-hidden bg-slate-900 border border-slate-800/60 shadow-2xl shadow-black/60"
          style={{ aspectRatio: '4/3' }}
        >
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={{ width: 1280, height: 960, facingMode: 'user' }}
            className="w-full h-full object-cover"
          />

          {/* Face oval */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`w-48 h-60 rounded-full border-2 transition-colors duration-300 ${
              isProcessing ? 'border-emerald-400 shadow-lg shadow-emerald-500/20' : 'border-white/25'
            }`} />
          </div>

          {/* Scanning animation */}
          {isProcessing && (
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
              <svg className="animate-spin w-10 h-10 text-emerald-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <p className="text-slate-300 text-sm font-medium">Identifying…</p>
            </div>
          )}

          {/* Corner decorations */}
          <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-white/20 rounded-tl-lg pointer-events-none" />
          <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-white/20 rounded-tr-lg pointer-events-none" />
          <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-white/20 rounded-bl-lg pointer-events-none" />
          <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-white/20 rounded-br-lg pointer-events-none" />
        </div>
      </div>

      {/* Bottom */}
      <div className="shrink-0 px-8 pb-8 pt-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <p className="text-center text-slate-500 text-sm">
            Position your face within the oval, then press the button to mark attendance
          </p>
          <button
            onClick={handleScan}
            disabled={isProcessing || scanPhase === 'success'}
            className={`w-full py-4 rounded-xl text-base font-bold transition-all duration-200 ${
              isProcessing || scanPhase === 'success'
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 active:scale-[0.98]'
            }`}
          >
            {isProcessing ? 'Scanning…' : 'Scan Attendance'}
          </button>
        </div>
      </div>

      {/* Result overlays */}
      {scanPhase === 'success' && result && (
        <SuccessOverlay result={result} onDismiss={handleDismiss} />
      )}
      {scanPhase === 'error' && (
        <ErrorOverlay kind={errorKind} message={errorMsg} onDismiss={handleDismiss} />
      )}
    </div>
  )
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function CheckinKiosk() {
  const [kioskPhase, setKioskPhase] = useState<KioskPhase>('admin_auth')
  const [kioskToken, setKioskToken] = useState<string>('')
  const [adminName, setAdminName] = useState<string>('')

  function handleAdminSuccess(token: string, name: string) {
    setKioskToken(token)
    setAdminName(name)
    setKioskPhase('active')
  }

  function handleLock() {
    setKioskToken('')
    setAdminName('')
    setKioskPhase('admin_auth')
  }

  if (kioskPhase === 'admin_auth') {
    return <AdminAuthGate onSuccess={handleAdminSuccess} />
  }

  return <ActiveKiosk kioskToken={kioskToken} adminName={adminName} onLock={handleLock} />
}

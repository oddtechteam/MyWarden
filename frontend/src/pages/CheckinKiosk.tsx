import { useRef, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Webcam from 'react-webcam'
import { submitCheckin, submitCheckout } from '@/api/attendance'
import type { AttendanceStatus, ICheckinResponse } from '@/types/attendance'

// ─── Types ──────────────────────────────────────────────────────────────────

type Mode = 'checkin' | 'checkout'
type Phase = 'idle' | 'processing' | 'success' | 'error'
type ErrorKind = 'no_face' | 'not_recognized' | 'already' | 'server'

interface KioskResult {
  employee_name: string | null
  status: AttendanceStatus
  shift_name: string | null
  timestamp: string
  mode: Mode
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
  // Naive ISO strings from the backend are UTC. Append 'Z' so JS doesn't
  // misinterpret them as local time when running on an IST system.
  return new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z')
}

function formatISTTime(iso: string): string {
  return parseUTC(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  }) + ' IST'
}

// ─── Clock widget ────────────────────────────────────────────────────────────

function LiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="text-right tabular-nums">
      <div className="text-slate-100 text-2xl font-light">
        {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' })}
        <span className="text-slate-500 text-sm font-normal ml-1.5">IST</span>
      </div>
      <div className="text-slate-500 text-sm">
        {now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' })}
      </div>
    </div>
  )
}

// ─── Status badge ────────────────────────────────────────────────────────────

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

// ─── Result overlay card ─────────────────────────────────────────────────────

function SuccessCard({ result, onDismiss }: { result: KioskResult; onDismiss: () => void }) {
  const isIn = result.mode === 'checkin'
  return (
    <div className="fixed inset-x-0 bottom-0 px-6 pb-6 pt-16 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pointer-events-none">
      <div
        className="max-w-xl mx-auto bg-emerald-950/90 border border-emerald-500/30 rounded-2xl p-6 backdrop-blur-md pointer-events-auto cursor-pointer animate-slide-up"
        onClick={onDismiss}
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-6 h-6 text-emerald-400">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-emerald-300 font-semibold text-lg truncate">
                {isIn ? `Welcome${result.employee_name ? ', ' + result.employee_name : ''}!` : `Goodbye${result.employee_name ? ', ' + result.employee_name : ''}!`}
              </p>
              <StatusBadge status={result.status} />
            </div>
            <p className="text-emerald-400/60 text-sm">
              {isIn ? 'Checked in' : 'Checked out'} at {formatISTTime(result.timestamp)}
              {result.shift_name ? ` · ${result.shift_name}` : ''}
            </p>
          </div>
        </div>
        <p className="text-emerald-500/40 text-xs mt-4 text-center">Tap to dismiss</p>
      </div>
    </div>
  )
}

function ErrorCard({
  kind,
  message,
  failCount,
  onDismiss,
}: {
  kind: ErrorKind
  message: string
  failCount: number
  onDismiss: () => void
}) {
  const colors: Record<ErrorKind, string> = {
    no_face:        'bg-slate-900/90 border-slate-700/50 text-slate-300',
    not_recognized: 'bg-orange-950/90 border-orange-500/30 text-orange-300',
    already:        'bg-amber-950/90 border-amber-500/30 text-amber-300',
    server:         'bg-rose-950/90 border-rose-500/30 text-rose-300',
  }
  const icons: Record<ErrorKind, string> = {
    no_face:        'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z',
    not_recognized: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0zM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632z',
    already:        'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
    server:         'M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z',
  }

  return (
    <div className="fixed inset-x-0 bottom-0 px-6 pb-6 pt-16 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pointer-events-none">
      <div
        className={`max-w-xl mx-auto border rounded-2xl p-6 backdrop-blur-md pointer-events-auto cursor-pointer ${colors[kind]}`}
        onClick={onDismiss}
      >
        <div className="flex items-start gap-4">
          <div className="shrink-0 mt-0.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-6 h-6 opacity-70">
              <path d={icons[kind]} />
            </svg>
          </div>
          <div>
            <p className="font-semibold">{message}</p>
            {kind === 'not_recognized' && failCount >= 3 && (
              <p className="text-sm mt-1 opacity-60">
                Having trouble? Ask HR for an OTP-based check-in.
              </p>
            )}
          </div>
        </div>
        <p className="text-xs mt-4 text-center opacity-40">Tap to try again</p>
      </div>
    </div>
  )
}

// ─── Main kiosk ──────────────────────────────────────────────────────────────

export default function CheckinKiosk() {
  const navigate = useNavigate()
  const webcamRef = useRef<Webcam>(null)
  const [mode, setMode] = useState<Mode>('checkin')
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<KioskResult | null>(null)
  const [errorKind, setErrorKind] = useState<ErrorKind>('server')
  const [errorMsg, setErrorMsg] = useState('')
  const [failCount, setFailCount] = useState(0)
  const resetRef = useRef<ReturnType<typeof setTimeout>>()

  const scheduleReset = useCallback((ms = 4000) => {
    clearTimeout(resetRef.current)
    resetRef.current = setTimeout(() => {
      setPhase('idle')
      setResult(null)
    }, ms)
  }, [])

  const handleDismiss = useCallback(() => {
    clearTimeout(resetRef.current)
    setPhase('idle')
    setResult(null)
  }, [])

  useEffect(() => () => clearTimeout(resetRef.current), [])

  async function handleScan() {
    if (phase !== 'idle') return
    const screenshot = webcamRef.current?.getScreenshot()
    if (!screenshot) return

    setPhase('processing')
    const blob = dataURLtoBlob(screenshot)

    try {
      const res: ICheckinResponse = mode === 'checkin'
        ? await submitCheckin(blob)
        : await submitCheckout(blob)

      setResult({
        employee_name: res.employee_name,
        status: res.status,
        shift_name: res.shift_name,
        timestamp: (mode === 'checkin' ? res.check_in_at : res.check_out_at) ?? new Date().toISOString(),
        mode,
      })
      setFailCount(0)
      setPhase('success')
      scheduleReset(6000)
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { detail?: string } } }
      const status = err.response?.status
      const detail = err.response?.data?.detail ?? 'Something went wrong. Please try again.'

      let kind: ErrorKind = 'server'
      if (status === 422) kind = 'no_face'
      else if (status === 404) { kind = 'not_recognized'; setFailCount((c) => c + 1) }
      else if (status === 409) kind = 'already'

      setErrorKind(kind)
      setErrorMsg(detail)
      setPhase('error')
      scheduleReset(4000)
    }
  }

  function handleModeChange(m: Mode) {
    if (phase === 'idle') {
      setMode(m)
      setFailCount(0)
    }
  }

  const isProcessing = phase === 'processing'

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col select-none overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-8 py-5 shrink-0">
        {/* Brand + back button */}
        <div className="flex items-center gap-4">
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
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/50 text-slate-400 hover:text-slate-200 hover:border-slate-600 text-sm transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Dashboard
          </button>
        </div>
        <LiveClock />
      </div>

      {/* ── Webcam area ── */}
      <div className="flex-1 flex items-center justify-center px-8 py-2 min-h-0">
        <div className="relative w-full max-w-2xl rounded-3xl overflow-hidden bg-slate-900 border border-slate-800/60 shadow-2xl shadow-black/60"
          style={{ aspectRatio: '4/3' }}>

          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={{ width: 1280, height: 960, facingMode: 'user' }}
            className="w-full h-full object-cover"
          />

          {/* Face oval guide */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`w-48 h-60 rounded-full border-2 transition-colors duration-300 ${
              isProcessing ? 'border-indigo-400 shadow-lg shadow-indigo-500/20' : 'border-white/25'
            }`} />
          </div>

          {/* Scanning line animation */}
          {isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 overflow-hidden h-60 rounded-full">
                <div className="h-0.5 bg-indigo-400/60 w-full animate-scan-line" />
              </div>
            </div>
          )}

          {/* Processing overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
              <svg className="animate-spin w-10 h-10 text-indigo-400" viewBox="0 0 24 24" fill="none">
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

      {/* ── Bottom section ── */}
      <div className="shrink-0 px-8 pb-8 pt-4">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Mode tabs */}
          <div className="flex gap-2 p-1 bg-slate-900/60 rounded-xl border border-slate-800/60">
            {(['checkin', 'checkout'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                disabled={isProcessing}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  mode === m
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m === 'checkin' ? 'Check In' : 'Check Out'}
              </button>
            ))}
          </div>

          {/* Hint */}
          <p className="text-center text-slate-500 text-sm">
            Position your face within the oval, then press the button below
          </p>

          {/* Action button */}
          <button
            onClick={handleScan}
            disabled={isProcessing || phase === 'success'}
            className={`w-full py-4 rounded-xl text-base font-bold transition-all duration-200 ${
              isProcessing || phase === 'success'
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : mode === 'checkin'
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 active:scale-[0.98]'
                : 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/20 active:scale-[0.98]'
            }`}
          >
            {isProcessing
              ? 'Scanning…'
              : mode === 'checkin'
              ? 'Check In'
              : 'Check Out'}
          </button>
        </div>
      </div>

      {/* ── Result overlays ── */}
      {phase === 'success' && result && (
        <SuccessCard result={result} onDismiss={handleDismiss} />
      )}
      {phase === 'error' && (
        <ErrorCard
          kind={errorKind}
          message={errorMsg}
          failCount={failCount}
          onDismiss={handleDismiss}
        />
      )}
    </div>
  )
}

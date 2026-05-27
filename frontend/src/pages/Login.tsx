import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, getMe } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'

// ─── Brand ───────────────────────────────────────────────────────────────────
const B = { blue: '#2563EB', blueDark: '#1D4ED8', cyan: '#22D3EE', white: '#F8FAFC' }

// ─── Logo mark: WardenBadge (Concept 06) ─────────────────────────────────────
function WardenBadge({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M22 8 H42 L56 22 V42 L42 56 H22 L8 42 V22 Z" fill={B.blue} />
      <path
        d="M20 42 V22 L32 34 L44 22 V42"
        stroke={B.white}
        strokeWidth="4.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="32" cy="47" r="2.8" fill={B.cyan} />
    </svg>
  )
}

// ─── Animated hero graphic ────────────────────────────────────────────────────
function HeroGraphic() {
  // 5 orbit dots at 60° intervals on r=96 ring
  const dots = [0, 72, 144, 216, 288].map((deg) => {
    const r = (deg * Math.PI) / 180
    return { x: 140 + 96 * Math.cos(r), y: 140 + 96 * Math.sin(r) }
  })

  return (
    <svg width="300" height="300" viewBox="0 0 280 280" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="hero-clip">
          <circle cx="140" cy="140" r="128" />
        </clipPath>
        <radialGradient id="center-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={B.blue} stopOpacity="0.25" />
          <stop offset="100%" stopColor={B.blue} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Glow backdrop */}
      <circle cx="140" cy="140" r="128" fill="url(#center-glow)" />

      {/* Outer dashed ring — slow clockwise */}
      <circle cx="140" cy="140" r="124" stroke={B.blue} strokeWidth="1" strokeDasharray="10 7" strokeOpacity="0.3">
        <animateTransform attributeName="transform" type="rotate" from="0 140 140" to="360 140 140" dur="45s" repeatCount="indefinite" />
      </circle>

      {/* Mid dashed ring — counter-clockwise */}
      <circle cx="140" cy="140" r="96" stroke={B.cyan} strokeWidth="1" strokeDasharray="5 10" strokeOpacity="0.2">
        <animateTransform attributeName="transform" type="rotate" from="0 140 140" to="-360 140 140" dur="30s" repeatCount="indefinite" />
      </circle>

      {/* Inner solid ring */}
      <circle cx="140" cy="140" r="66" stroke={B.blue} strokeWidth="1.5" strokeOpacity="0.35" />

      {/* Corner brackets */}
      {(['M46 80 V54 H72', 'M234 80 V54 H208', 'M234 200 V226 H208', 'M46 200 V226 H72'] as const).map((d, i) => (
        <path key={i} d={d} stroke={B.blue} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.55" />
      ))}

      {/* Orbit dots (static positions, blink at different rates) */}
      {dots.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={i === 0 ? 6 : 4.5} fill={i % 2 === 0 ? B.blue : B.cyan}>
          <animate attributeName="opacity" values="0.5;1;0.5" dur={`${1.8 + i * 0.5}s`} repeatCount="indefinite" />
          <animate attributeName="r" values={`${i === 0 ? 5 : 3.5};${i === 0 ? 7 : 5.5};${i === 0 ? 5 : 3.5}`} dur={`${2 + i * 0.4}s`} repeatCount="indefinite" />
        </circle>
      ))}

      {/* Scan line (clipped) */}
      <line x1="52" y1="60" x2="228" y2="60" stroke={B.cyan} strokeWidth="1.5" strokeLinecap="round" clipPath="url(#hero-clip)">
        <animate attributeName="y1" from="50" to="230" dur="3.2s" repeatCount="indefinite" />
        <animate attributeName="y2" from="50" to="230" dur="3.2s" repeatCount="indefinite" />
        <animate attributeName="stroke-opacity" values="0;0.85;0.85;0" keyTimes="0;0.05;0.93;1" dur="3.2s" repeatCount="indefinite" />
      </line>

      {/* Center badge container */}
      <circle cx="140" cy="140" r="52" fill="#070C14">
        <animate attributeName="r" values="50;53;50" dur="4s" repeatCount="indefinite" />
      </circle>
      <circle cx="140" cy="140" r="52" stroke={B.blue} strokeWidth="1" strokeOpacity="0.4">
        <animate attributeName="stroke-opacity" values="0.3;0.6;0.3" dur="4s" repeatCount="indefinite" />
      </circle>

      {/* WardenBadge centered (badge 64px → offset -32) */}
      <g transform="translate(108,108)">
        <path d="M22 8 H42 L56 22 V42 L42 56 H22 L8 42 V22 Z" fill={B.blue} />
        <path d="M20 42 V22 L32 34 L44 22 V42" stroke={B.white} strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round" fill="none" />
        <circle cx="32" cy="47" r="2.8" fill={B.cyan}>
          <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  )
}

// ─── Feature pill ─────────────────────────────────────────────────────────────
function Pill({ icon, text, delay }: { icon: React.ReactNode; text: string; delay: string }) {
  return (
    <div
      style={{ animationDelay: delay }}
      className="mw-fade-up flex items-center gap-2 bg-slate-900/70 border border-slate-700/50 rounded-full px-4 py-2 backdrop-blur-sm"
    >
      <span className="text-blue-400">{icon}</span>
      <span className="text-slate-300 text-sm font-medium whitespace-nowrap">{text}</span>
    </div>
  )
}

// ─── Floating stat card ───────────────────────────────────────────────────────
function StatCard({
  value, label, accent = false, floatDelay = '0s',
}: { value: string; label: string; accent?: boolean; floatDelay?: string }) {
  return (
    <div
      style={{ animation: `mw-float 4.5s ease-in-out infinite`, animationDelay: floatDelay }}
      className="bg-slate-900/90 backdrop-blur-sm border border-slate-700/60 rounded-2xl px-5 py-4 shadow-2xl shadow-black/50"
    >
      <p className={`text-2xl font-bold leading-none mb-1 ${accent ? 'text-cyan-400' : 'text-white'}`}>{value}</p>
      <p className="text-slate-500 text-xs">{label}</p>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Login() {
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  const { setAuth }                   = useAuthStore()
  const navigate                      = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const tokenRes = await login({ email, password })
      const { access_token, refresh_token } = tokenRes.data
      localStorage.setItem('access_token', access_token)
      localStorage.setItem('refresh_token', refresh_token)
      const meRes = await getMe()
      setAuth(meRes.data, access_token, refresh_token)
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? err.message
          : 'Login failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* ── Global keyframes ── */}
      <style>{`
        @keyframes mw-float {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-10px); }
        }
        @keyframes mw-glow-pulse {
          0%,100% { opacity: 0.12; transform: scale(1); }
          50%     { opacity: 0.28; transform: scale(1.12); }
        }
        @keyframes mw-shimmer {
          from { background-position: 200% center; }
          to   { background-position: -200% center; }
        }
        @keyframes mw-fade-up {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes mw-slide-in {
          from { opacity: 0; transform: translateX(18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .mw-fade-up  { animation: mw-fade-up  0.7s ease-out both; }
        .mw-slide-in { animation: mw-slide-in 0.6s ease-out both; }

        /* Shimmering button sweep */
        .mw-btn-sweep::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.09) 50%, transparent 65%);
          transform: translateX(-100%);
          transition: transform 0.6s;
        }
        .mw-btn-sweep:hover::after { transform: translateX(100%); }

        /* Input glow on focus */
        .mw-input:focus {
          border-color: rgba(37,99,235,0.7);
          box-shadow: 0 0 0 3px rgba(37,99,235,0.12), 0 1px 3px rgba(0,0,0,0.4);
        }
      `}</style>

      <div className="min-h-screen flex bg-[#070C14] overflow-hidden">

        {/* ══════════════ LEFT HERO PANEL ══════════════ */}
        <div className="hidden lg:flex lg:w-[58%] relative overflow-hidden flex-col items-center justify-center p-12">

          {/* Background orbs */}
          <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.16) 0%, transparent 68%)', animation: 'mw-glow-pulse 7s ease-in-out infinite' }} />
          <div className="absolute bottom-1/4 right-1/4 w-[360px] h-[360px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.10) 0%, transparent 70%)', animation: 'mw-glow-pulse 9s ease-in-out infinite', animationDelay: '-4s' }} />
          <div className="absolute top-1/2 right-1/3 w-[240px] h-[240px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)', animation: 'mw-glow-pulse 6s ease-in-out infinite', animationDelay: '-2s' }} />

          {/* Dot grid */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'radial-gradient(circle, rgba(37,99,235,0.18) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />

          {/* Vertical separator gradient */}
          <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-slate-700/40 to-transparent" />

          {/* ── Content ── */}
          <div className="relative z-10 flex flex-col items-center text-center max-w-lg w-full">

            {/* Hero graphic */}
            <div style={{ animation: 'mw-fade-up 0.9s ease-out both' }}>
              <HeroGraphic />
            </div>

            {/* Tagline */}
            <div className="mt-6 mb-2 mw-fade-up" style={{ animationDelay: '0.25s' }}>
              <h2 className="text-[2.2rem] font-bold text-white leading-tight tracking-tight">
                Your workforce,{' '}
                <span style={{
                  background: `linear-gradient(90deg, ${B.blue}, ${B.cyan}, ${B.blue})`,
                  backgroundSize: '200% auto',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  animation: 'mw-shimmer 4s linear infinite',
                }}>
                  secured.
                </span>
              </h2>
              <p className="text-slate-400 text-base mt-2.5 leading-relaxed">
                All-in-one platform for modern HR teams.
              </p>
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2.5 justify-center mt-7" style={{ animation: 'mw-fade-up 0.7s ease-out 0.45s both' }}>
              <Pill delay="0s" text="Face Recognition Attendance"
                icon={<svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>}
              />
              <Pill delay="0.1s" text="Automated Payroll Engine"
                icon={<svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.798 7.45c.512-.67 1.135-1.2 2.202-1.2 1.357 0 2 .89 2 1.75s-.643 1.575-1.455 2.025c-.623.348-1.045.614-1.296 1.006a.75.75 0 01-1.498-.062c0-.799.457-1.37.977-1.77.32-.245.693-.45.952-.596.345-.192.57-.418.57-.603 0-.295-.268-.5-.75-.5-.49 0-.803.212-1.052.538a.75.75 0 01-1.65-.488zM10 15a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>}
              />
              <Pill delay="0.2s" text="Smart Leave Management"
                icon={<svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" /></svg>}
              />
            </div>

            {/* Floating stat cards */}
            <div className="flex gap-4 mt-8" style={{ animation: 'mw-fade-up 0.7s ease-out 0.65s both' }}>
              <StatCard value="< 2s"   label="Recognition time"     floatDelay="0s"    />
              <StatCard value="99.9%"  label="Payroll accuracy"     accent floatDelay="1.2s" />
              <StatCard value="All-in" label="One platform, everything" floatDelay="2.1s" />
            </div>
          </div>
        </div>

        {/* ══════════════ RIGHT FORM PANEL ══════════════ */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-10 relative">
          {/* Subtle bg gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/50 to-[#070C14] pointer-events-none" />

          <div className="relative w-full max-w-[360px] mw-slide-in">

            {/* Logo lockup */}
            <div className="flex items-center gap-3 mb-10">
              <WardenBadge size={46} />
              <div>
                <p className="text-white font-bold text-[1.6rem] tracking-tight leading-none">MyWarden</p>
                <p className="text-slate-600 text-xs mt-1 tracking-wide">Employee Management System</p>
              </div>
            </div>

            {/* Heading */}
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-slate-100 leading-tight">Welcome back</h1>
              <p className="text-slate-500 text-sm mt-1">Enter your credentials to sign in.</p>
            </div>

            {/* ── Form ── */}
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
                    placeholder="you@company.com"
                    className="mw-input w-full bg-slate-900/80 border border-slate-800 text-slate-100 placeholder-slate-700 rounded-xl pl-11 pr-4 py-3.5 text-sm outline-none transition-all"
                    required autoFocus autoComplete="email"
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
                    className="mw-input w-full bg-slate-900/80 border border-slate-800 text-slate-100 placeholder-slate-700 rounded-xl pl-11 pr-12 py-3.5 text-sm outline-none transition-all"
                    required autoComplete="current-password"
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
                className="mw-btn-sweep relative w-full py-3.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-1 overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${B.blue} 0%, ${B.blueDark} 100%)`,
                  boxShadow: '0 4px 24px rgba(37,99,235,0.35)',
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Signing in…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Sign in
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-slate-800/60 text-center">
              <p className="text-xs text-slate-600">
                Need an account?{' '}
                <span className="text-slate-500 font-medium">Contact your HR administrator.</span>
              </p>
            </div>

            {/* Mobile-only feature row */}
            <div className="mt-6 flex gap-3 justify-center lg:hidden">
              {['Face ID', 'Payroll', 'Leave'].map((f) => (
                <span key={f} className="text-xs text-slate-600 border border-slate-800 rounded-full px-3 py-1">{f}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

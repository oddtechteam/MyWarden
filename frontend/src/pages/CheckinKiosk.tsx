export default function CheckinKiosk() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-indigo-500/30">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.75} className="w-8 h-8">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-slate-100">Check-in Kiosk</h1>
        <p className="text-slate-500 mt-2">Face recognition attendance — coming in Phase 2.</p>
      </div>
    </div>
  )
}

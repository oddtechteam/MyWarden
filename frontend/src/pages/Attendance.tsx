import Layout from '@/components/app/Layout'

export default function Attendance() {
  return (
    <Layout title="Attendance">
      <div className="max-w-7xl mx-auto">
        <div className="rounded-2xl border border-slate-800/60 bg-slate-800/20 flex flex-col items-center justify-center py-24 text-slate-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 mb-4">
            <circle cx="12" cy="12" r="9" />
            <polyline points="12 7 12 12 15 15" />
          </svg>
          <p className="text-base font-medium text-slate-500">Attendance Module</p>
          <p className="text-sm mt-1">Coming in Phase 2 — face check-in, shifts, and reports.</p>
        </div>
      </div>
    </Layout>
  )
}

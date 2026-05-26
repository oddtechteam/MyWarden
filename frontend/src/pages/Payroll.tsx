import Layout from '@/components/app/Layout'

export default function Payroll() {
  return (
    <Layout title="Payroll">
      <div className="max-w-7xl mx-auto">
        <div className="rounded-2xl border border-slate-800/60 bg-slate-800/20 flex flex-col items-center justify-center py-24 text-slate-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 mb-4">
            <rect x="1" y="4" width="22" height="16" rx="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
          <p className="text-base font-medium text-slate-500">Payroll Module</p>
          <p className="text-sm mt-1">Coming in Phase 3 — salary engine, deductions, and payslips.</p>
        </div>
      </div>
    </Layout>
  )
}

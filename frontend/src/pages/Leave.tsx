import Layout from '@/components/app/Layout'

export default function Leave() {
  return (
    <Layout title="Leave">
      <div className="max-w-7xl mx-auto">
        <div className="rounded-2xl border border-slate-800/60 bg-slate-800/20 flex flex-col items-center justify-center py-24 text-slate-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 mb-4">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <p className="text-base font-medium text-slate-500">Leave Module</p>
          <p className="text-sm mt-1">Coming in Phase 2 — apply, approve, and track leave requests.</p>
        </div>
      </div>
    </Layout>
  )
}

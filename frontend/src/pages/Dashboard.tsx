import Layout from '@/components/app/Layout'
import { useAuthStore } from '@/store/authStore'

const stats = [
  { label: 'Total Employees', value: '—', icon: '👥', color: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/20 text-indigo-400' },
  { label: 'Present Today', value: '—', icon: '✅', color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20 text-emerald-400' },
  { label: 'On Leave', value: '—', icon: '🏖️', color: 'from-amber-500/20 to-amber-600/10 border-amber-500/20 text-amber-400' },
  { label: 'Pending Payroll', value: '—', icon: '💰', color: 'from-violet-500/20 to-violet-600/10 border-violet-500/20 text-violet-400' },
]

export default function Dashboard() {
  const { user } = useAuthStore()

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-100">
            {greeting()},{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
              {user?.full_name?.split(' ')[0] ?? 'there'}
            </span>
            !
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
          {stats.map(({ label, value, icon, color }) => (
            <div
              key={label}
              className={`rounded-2xl border bg-gradient-to-br p-5 ${color}`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">{icon}</span>
              </div>
              <p className="text-3xl font-bold text-slate-100 mb-0.5">{value}</p>
              <p className="text-slate-400 text-sm">{label}</p>
            </div>
          ))}
        </div>

        {/* Placeholder panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-800/60 bg-slate-800/30 p-6">
            <h3 className="text-slate-200 font-semibold mb-4">Recent Activity</h3>
            <div className="flex flex-col items-center justify-center py-12 text-slate-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 mb-3">
                <circle cx="12" cy="12" r="9" />
                <polyline points="12 7 12 12 15 15" />
              </svg>
              <p className="text-sm">Activity data coming in Phase 2</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/60 bg-slate-800/30 p-6">
            <h3 className="text-slate-200 font-semibold mb-4">Pending Approvals</h3>
            <div className="flex flex-col items-center justify-center py-12 text-slate-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 mb-3">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              <p className="text-sm">Approvals coming in Phase 2</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

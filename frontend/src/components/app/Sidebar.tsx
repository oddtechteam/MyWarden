import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { logout } from '@/api/auth'
import WardenBadge from './WardenBadge'

const nav = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    to: '/employees',
    label: 'Employees',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    to: '/attendance',
    label: 'Attendance',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5">
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 15" />
      </svg>
    ),
  },
  {
    to: '/payroll',
    label: 'Payroll',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5">
        <rect x="1" y="4" width="22" height="16" rx="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    to: '/leave',
    label: 'Leave',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    to: '/reports',
    label: 'Reports',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6"  y1="20" x2="6"  y2="14" />
        <line x1="2"  y1="20" x2="22" y2="20" />
      </svg>
    ),
  },
]

export default function Sidebar() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  async function handleLogout() {
    try { await logout() } catch { /* ignore */ }
    clearAuth()
    navigate('/login')
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? 'U'

  return (
    <aside className="fixed inset-y-0 left-0 w-64 flex flex-col bg-slate-950 border-r border-slate-800/60 z-40">

      {/* ── Brand ─────────────────────────────────────────── */}
      <div className="h-16 flex items-center px-5 border-b border-slate-800/60 shrink-0">
        <div className="flex items-center gap-3">
          {/* Logo with breathing glow */}
          <div className="relative flex-shrink-0 flex items-center justify-center">
            <div className="absolute w-10 h-10 rounded-full bg-blue-500/20 blur-md mw-sb-logo-glow pointer-events-none" />
            <WardenBadge size={30} />
          </div>
          <div>
            <p className="text-slate-100 font-bold text-base tracking-tight leading-none">MyWarden</p>
            <p className="text-slate-600 text-[10px] tracking-wide mt-0.5">Management System</p>
          </div>
        </div>
      </div>

      {/* ── Navigation ────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
          Main
        </p>

        {nav.map(({ to, label, icon }, i) => (
          <div
            key={to}
            className="mw-sb-item"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <NavLink
              to={to}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 hover:translate-x-0.5'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Active left accent bar */}
                  {isActive && (
                    <span className="mw-sb-active-bar absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-indigo-400" />
                  )}

                  {/* Icon */}
                  <span
                    className={`transition-all duration-200 ${
                      isActive
                        ? 'text-indigo-400 drop-shadow-[0_0_6px_rgba(129,140,248,0.6)]'
                        : 'text-slate-500 group-hover:text-slate-300 group-hover:scale-105'
                    }`}
                  >
                    {icon}
                  </span>

                  {/* Label */}
                  <span className="flex-1 transition-transform duration-200 group-hover:translate-x-0.5">
                    {label}
                  </span>

                  {/* Active pulse dot */}
                  {isActive && (
                    <span className="mw-sb-active-dot w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                  )}
                </>
              )}
            </NavLink>
          </div>
        ))}
      </nav>

      {/* ── Settings (super_admin only) ───────────────────── */}
      {user?.role === 'super_admin' && (
        <div
          className="mw-sb-item px-3 pb-2 border-t border-slate-800/60 pt-3 shrink-0"
          style={{ animationDelay: `${nav.length * 40}ms` }}
        >
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-indigo-600/15 text-indigo-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 hover:translate-x-0.5'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="mw-sb-active-bar absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-indigo-400" />
                )}
                <span
                  className={`transition-all duration-200 ${
                    isActive
                      ? 'text-indigo-400 drop-shadow-[0_0_6px_rgba(129,140,248,0.6)]'
                      : 'text-slate-500 group-hover:text-slate-300 group-hover:scale-105'
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </span>
                <span className="flex-1 transition-transform duration-200 group-hover:translate-x-0.5">
                  Settings
                </span>
                {isActive && (
                  <span className="mw-sb-active-dot w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                )}
              </>
            )}
          </NavLink>
        </div>
      )}

      {/* ── User profile + logout ─────────────────────────── */}
      <div
        className={`mw-sb-item px-3 pb-4 shrink-0 space-y-1 ${user?.role === 'super_admin' ? '' : 'border-t border-slate-800/60 pt-3'}`}
        style={{ animationDelay: `${(nav.length + 1) * 40}ms` }}
      >
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group hover:translate-x-0.5 ${
              isActive ? 'bg-indigo-600/15' : 'hover:bg-slate-800/60'
            }`
          }
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0 transition-transform duration-200 group-hover:scale-105 shadow-md shadow-indigo-500/20">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-200 text-sm font-medium truncate group-hover:text-white transition-colors">
              {user?.full_name ?? user?.email ?? 'User'}
            </p>
            <p className="text-slate-500 text-xs truncate capitalize">
              {user?.role?.replace('_', ' ') ?? 'employee'}
            </p>
          </div>
        </NavLink>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 hover:translate-x-0.5 transition-all duration-200 group"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5 text-slate-500 group-hover:text-red-400 transition-colors shrink-0">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span className="transition-transform duration-200 group-hover:translate-x-0.5">Sign out</span>
        </button>
      </div>
    </aside>
  )
}

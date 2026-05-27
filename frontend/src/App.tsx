import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import Attendance from './pages/Attendance'
import Payroll from './pages/Payroll'
import Leave from './pages/Leave'
import CheckinKiosk from './pages/CheckinKiosk'
import { useAuthStore } from './store/authStore'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuthStore()
  return accessToken ? <>{children}</> : <Navigate to="/login" replace />
}

function BootstrapSpinner() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 animate-pulse">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-5 h-5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <p className="text-slate-500 text-sm">Loading…</p>
      </div>
    </div>
  )
}

function App() {
  const { isBootstrapping, bootstrapAuth } = useAuthStore()

  useEffect(() => {
    bootstrapAuth()
  }, [bootstrapAuth])

  if (isBootstrapping) return <BootstrapSpinner />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
        <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
        <Route path="/payroll" element={<ProtectedRoute><Payroll /></ProtectedRoute>} />
        <Route path="/leave" element={<ProtectedRoute><Leave /></ProtectedRoute>} />
        <Route path="/kiosk" element={<ProtectedRoute><CheckinKiosk /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

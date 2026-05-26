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

function App() {
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

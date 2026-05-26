import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import Attendance from './pages/Attendance'
import Payroll from './pages/Payroll'
import Leave from './pages/Leave'
import CheckinKiosk from './pages/CheckinKiosk'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/payroll" element={<Payroll />} />
        <Route path="/leave" element={<Leave />} />
        <Route path="/kiosk" element={<CheckinKiosk />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

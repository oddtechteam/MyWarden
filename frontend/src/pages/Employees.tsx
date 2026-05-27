import { useState, useEffect, useCallback, useRef } from 'react'
import Webcam from 'react-webcam'
import Layout from '@/components/app/Layout'
import {
  listEmployees,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
  listDepartments,
  enrollFace,
} from '@/api/employees'
import type { IEmployee, IEmployeeCreate, IEmployeeUpdate, IDepartment, UserRole, EmployeeType } from '@/types/employee'

// ─── Badges ────────────────────────────────────────────────────────────────

const ROLE_STYLES: Record<string, string> = {
  super_admin: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  hr_admin:    'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',
  manager:     'bg-blue-500/15 text-blue-400 border-blue-500/25',
  employee:    'bg-slate-500/15 text-slate-400 border-slate-500/25',
}

const TYPE_STYLES: Record<string, string> = {
  FULL_TIME: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  HOURLY:    'bg-amber-500/15 text-amber-400 border-amber-500/25',
  CONTRACT:  'bg-rose-500/15 text-rose-400 border-rose-500/25',
}

function Badge({ label, style }: { label: string; style: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${style}`}>
      {label}
    </span>
  )
}

function Avatar({ name, email }: { name: string | null; email: string }) {
  const text = name
    ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : email[0].toUpperCase()
  const colors = [
    'from-indigo-500 to-violet-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
  ]
  const color = colors[(email.charCodeAt(0) + email.charCodeAt(1)) % colors.length]
  return (
    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
      {text}
    </div>
  )
}

// ─── Employee form drawer ──────────────────────────────────────────────────

interface FormProps {
  mode: 'create' | 'edit'
  initial?: IEmployee
  departments: IDepartment[]
  onSubmit: (data: IEmployeeCreate | IEmployeeUpdate) => Promise<void>
  onClose: () => void
}

function EmployeeForm({ mode, initial, departments, onSubmit, onClose }: FormProps) {
  const [form, setForm] = useState({
    full_name: initial?.full_name ?? '',
    email: initial?.email ?? '',
    password: '',
    phone: initial?.phone ?? '',
    job_title: initial?.job_title ?? '',
    role: (initial?.role ?? 'employee') as UserRole,
    employee_type: (initial?.employee_type ?? 'FULL_TIME') as EmployeeType,
    department_id: initial?.department_id ?? '',
    join_date: initial?.join_date ?? '',
    base_salary: initial?.base_salary ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        full_name: form.full_name || undefined,
        phone: form.phone || undefined,
        job_title: form.job_title || undefined,
        role: form.role,
        employee_type: form.employee_type,
        department_id: form.department_id || undefined,
        join_date: form.join_date || undefined,
        base_salary: form.base_salary ? Number(form.base_salary) : undefined,
      }
      if (mode === 'create') {
        payload.email = form.email
        payload.password = form.password
        payload.full_name = form.full_name
      }
      await onSubmit(payload as IEmployeeCreate | IEmployeeUpdate)
      onClose()
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? 'Failed to save'
      setErr(msg)
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full bg-slate-800/60 border border-slate-700/60 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto h-full w-full max-w-xl bg-slate-900 border-l border-slate-800/60 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 shrink-0">
          <div>
            <h2 className="text-slate-100 font-semibold text-base">
              {mode === 'create' ? 'Add New Employee' : 'Edit Employee'}
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">
              {mode === 'create'
                ? 'Fill in the details to register a new team member.'
                : 'Update the employee profile.'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form id="emp-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className={labelCls}>Full Name *</label>
            <input
              className={inputCls}
              value={form.full_name}
              onChange={(e) => set('full_name', e.target.value)}
              placeholder="Jane Doe"
              required
            />
          </div>

          {mode === 'create' && (
            <>
              <div>
                <label className={labelCls}>Email Address *</label>
                <input
                  type="email"
                  className={inputCls}
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="jane@company.com"
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Temporary Password *</label>
                <input
                  type="password"
                  className={inputCls}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder="Min 8 characters"
                  required
                  minLength={8}
                />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Phone</label>
              <input
                className={inputCls}
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
            <div>
              <label className={labelCls}>Job Title</label>
              <input
                className={inputCls}
                value={form.job_title}
                onChange={(e) => set('job_title', e.target.value)}
                placeholder="Software Engineer"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Role *</label>
              <select
                className={inputCls}
                value={form.role}
                onChange={(e) => set('role', e.target.value)}
                required
              >
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="hr_admin">HR Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Employee Type *</label>
              <select
                className={inputCls}
                value={form.employee_type}
                onChange={(e) => set('employee_type', e.target.value)}
                required
              >
                <option value="FULL_TIME">Full Time</option>
                <option value="HOURLY">Hourly</option>
                <option value="CONTRACT">Contract</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Department</label>
            <select
              className={inputCls}
              value={form.department_id}
              onChange={(e) => set('department_id', e.target.value)}
            >
              <option value="">— No department —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Join Date</label>
              <input
                type="date"
                className={inputCls}
                value={form.join_date}
                onChange={(e) => set('join_date', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Base Salary (₹)</label>
              <input
                type="number"
                className={inputCls}
                value={form.base_salary}
                onChange={(e) => set('base_salary', e.target.value)}
                placeholder="50000"
                min="0"
              />
            </div>
          </div>

          {err && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
              {err}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800/60 flex gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            form="emp-form"
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20"
          >
            {saving ? 'Saving…' : mode === 'create' ? 'Add Employee' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Face enrollment modal ─────────────────────────────────────────────────

const FRAME_COUNT = 8
const CAPTURE_INTERVAL_MS = 500

type EnrollState = 'idle' | 'capturing' | 'uploading' | 'done' | 'error'

function dataURLtoBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)![1]
  const binary = atob(b64)
  const arr = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

function EnrollmentModal({ employee, onClose, onDone }: { employee: IEmployee; onClose: () => void; onDone: () => void }) {
  const webcamRef = useRef<Webcam>(null)
  const [state, setState] = useState<EnrollState>('idle')
  const [captured, setCaptured] = useState(0)
  const [error, setError] = useState('')

  async function startCapture() {
    setState('capturing')
    setCaptured(0)
    const frames: Blob[] = []

    for (let i = 0; i < FRAME_COUNT; i++) {
      await new Promise((r) => setTimeout(r, CAPTURE_INTERVAL_MS))
      const shot = webcamRef.current?.getScreenshot()
      if (shot) {
        frames.push(dataURLtoBlob(shot))
        setCaptured(i + 1)
      }
    }

    if (frames.length < 8) {
      setState('error')
      setError('Could not capture enough frames. Make sure your face is visible and well-lit.')
      return
    }

    setState('uploading')
    try {
      await enrollFace(employee.id, frames)
      setState('done')
      onDone()
    } catch (e: unknown) {
      setState('error')
      setError(
        (e as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
          'Upload failed. Please try again.'
      )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm" onClick={state === 'idle' || state === 'done' || state === 'error' ? onClose : undefined} />
      <div className="relative bg-slate-900 border border-slate-800/60 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60">
          <div>
            <h2 className="text-slate-100 font-semibold">Face Enrollment</h2>
            <p className="text-slate-500 text-xs mt-0.5">
              {employee.full_name ?? employee.email}
            </p>
          </div>
          {(state === 'idle' || state === 'done' || state === 'error') && (
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Webcam area */}
        <div className="relative bg-slate-950 aspect-video flex items-center justify-center overflow-hidden">
          {state !== 'done' && (
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={{ width: 640, height: 480, facingMode: 'user' }}
              className="w-full h-full object-cover"
            />
          )}

          {/* Face guide overlay */}
          {(state === 'idle' || state === 'capturing') && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={`w-44 h-56 rounded-full border-2 ${state === 'capturing' ? 'border-indigo-400' : 'border-white/30'} transition-colors`} />
            </div>
          )}

          {/* Capture progress overlay */}
          {state === 'capturing' && (
            <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-2">
              <div className="flex gap-1.5">
                {Array.from({ length: FRAME_COUNT }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${i < captured ? 'bg-indigo-400 scale-110' : 'bg-white/20'}`}
                  />
                ))}
              </div>
              <span className="text-white/80 text-xs bg-slate-950/60 px-3 py-1 rounded-full">
                Capturing {captured} / {FRAME_COUNT}
              </span>
            </div>
          )}

          {/* Uploading overlay */}
          {state === 'uploading' && (
            <div className="absolute inset-0 bg-slate-950/70 flex flex-col items-center justify-center gap-3">
              <svg className="animate-spin w-8 h-8 text-indigo-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <p className="text-slate-300 text-sm">Uploading frames…</p>
            </div>
          )}

          {/* Done overlay */}
          {state === 'done' && (
            <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-8 h-8 text-emerald-400">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-slate-100 font-semibold">Frames uploaded!</p>
              <p className="text-slate-400 text-sm text-center px-6">
                DeepFace is processing in the background.<br />
                The <span className="text-emerald-400">face enrolled</span> badge will appear once complete (~30s).
              </p>
            </div>
          )}

          {/* Error overlay */}
          {state === 'error' && (
            <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-3 px-6">
              <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6 text-red-400">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}
        </div>

        {/* Instructions + action */}
        <div className="px-6 py-4 space-y-3">
          {state === 'idle' && (
            <>
              <p className="text-slate-400 text-xs text-center">
                Position the employee's face inside the oval. Ensure good lighting.<br />
                {FRAME_COUNT} photos will be captured automatically.
              </p>
              <button
                onClick={startCapture}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all shadow-lg shadow-indigo-500/20"
              >
                Start Capture
              </button>
            </>
          )}

          {state === 'capturing' && (
            <p className="text-slate-400 text-xs text-center py-1">
              Hold still — capturing {FRAME_COUNT} frames…
            </p>
          )}

          {state === 'done' && (
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors"
            >
              Done
            </button>
          )}

          {state === 'error' && (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setState('idle'); setError('') }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Confirm deactivate dialog ─────────────────────────────────────────────

function ConfirmDialog({
  employee,
  onConfirm,
  onClose,
}: {
  employee: IEmployee
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  async function go() {
    setLoading(true)
    await onConfirm()
    setLoading(false)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-800/60 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-red-400">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </div>
        <h3 className="text-slate-100 font-semibold text-center mb-1">Deactivate Employee</h3>
        <p className="text-slate-400 text-sm text-center mb-6">
          Are you sure you want to deactivate{' '}
          <span className="text-slate-200 font-medium">{employee.full_name ?? employee.email}</span>? They
          will lose access immediately.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={go}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Deactivating…' : 'Deactivate'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function Employees() {
  const [employees, setEmployees] = useState<IEmployee[]>([])
  const [departments, setDepartments] = useState<IDepartment[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<IEmployee | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<IEmployee | null>(null)
  const [enrollTarget, setEnrollTarget] = useState<IEmployee | null>(null)

  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listEmployees({
        page,
        limit: 15,
        search: search || undefined,
        employee_type: filterType || undefined,
        department_id: filterDept || undefined,
      })
      setEmployees(res.items)
      setTotal(res.total)
      setPages(res.pages)
    } finally {
      setLoading(false)
    }
  }, [page, search, filterType, filterDept])

  useEffect(() => { fetchEmployees() }, [fetchEmployees])
  useEffect(() => { listDepartments().then(setDepartments).catch(() => {}) }, [])
  useEffect(() => { setPage(1) }, [search, filterType, filterDept])

  async function handleCreate(data: IEmployeeCreate | IEmployeeUpdate) {
    await createEmployee(data as IEmployeeCreate)
    await fetchEmployees()
  }

  async function handleEdit(data: IEmployeeCreate | IEmployeeUpdate) {
    if (!editTarget) return
    await updateEmployee(editTarget.id, data as IEmployeeUpdate)
    await fetchEmployees()
  }

  async function handleDeactivate() {
    if (!deleteTarget) return
    await deactivateEmployee(deleteTarget.id)
    setDeleteTarget(null)
    await fetchEmployees()
  }

  return (
    <Layout title="Employees">
      <div className="max-w-7xl mx-auto">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <p className="text-slate-400 text-sm">
            {loading ? 'Loading…' : `${total} employee${total !== 1 ? 's' : ''} found`}
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all shadow-lg shadow-indigo-500/20 self-start sm:self-auto"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Employee
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-800/60 border border-slate-700/60 text-slate-100 placeholder-slate-500 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-800/60 border border-slate-700/60 text-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
          >
            <option value="">All Types</option>
            <option value="FULL_TIME">Full Time</option>
            <option value="HOURLY">Hourly</option>
            <option value="CONTRACT">Contract</option>
          </select>
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="bg-slate-800/60 border border-slate-700/60 text-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-slate-800/60 bg-slate-800/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800/60">
                  {['Employee', 'Role', 'Department', 'Type', 'Join Date', ''].map((h) => (
                    <th
                      key={h}
                      className={`px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500 ${h === '' ? 'text-right' : 'text-left'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="h-4 bg-slate-800 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : employees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center text-slate-600">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 mb-3">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                        </svg>
                        <p className="text-sm">No employees found</p>
                        <p className="text-xs mt-1 text-slate-700">Try adjusting your filters or add a new employee.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={emp.full_name} email={emp.email} />
                          <div className="min-w-0">
                            <p className="text-slate-100 font-medium truncate">{emp.full_name ?? '—'}</p>
                            <p className="text-slate-500 text-xs truncate">{emp.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge label={emp.role.replace('_', ' ')} style={ROLE_STYLES[emp.role]} />
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 text-sm">
                        {emp.department?.name ?? <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge label={emp.employee_type.replace('_', ' ')} style={TYPE_STYLES[emp.employee_type]} />
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 text-sm">
                        {emp.join_date
                          ? new Date(emp.join_date).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {/* Face enrolled badge — always visible */}
                          {emp.face_enrolled ? (
                            <span className="mr-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border bg-emerald-500/15 text-emerald-400 border-emerald-500/25">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                              </svg>
                              enrolled
                            </span>
                          ) : (
                            <span className="mr-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border bg-slate-700/40 text-slate-500 border-slate-700/60">
                              not enrolled
                            </span>
                          )}

                          {/* Hover actions */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setEnrollTarget(emp)}
                              title="Enroll face"
                              className="p-2 rounded-lg text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 transition-all"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4">
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                <circle cx="12" cy="13" r="4" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setEditTarget(emp)}
                              title="Edit"
                              className="p-2 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeleteTarget(emp)}
                              title="Deactivate"
                              className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6M14 11v6" />
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-slate-500 text-sm">Page {page} of {pages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3.5 py-2 rounded-lg text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="px-3.5 py-2 rounded-lg text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <EmployeeForm
          mode="create"
          departments={departments}
          onSubmit={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}

      {editTarget && (
        <EmployeeForm
          mode="edit"
          initial={editTarget}
          departments={departments}
          onSubmit={handleEdit}
          onClose={() => setEditTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          employee={deleteTarget}
          onConfirm={handleDeactivate}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {enrollTarget && (
        <EnrollmentModal
          employee={enrollTarget}
          onClose={() => setEnrollTarget(null)}
          onDone={() => {
            setEnrollTarget(null)
            fetchEmployees()
          }}
        />
      )}
    </Layout>
  )
}

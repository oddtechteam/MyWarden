export type EmployeeType = 'FULL_TIME' | 'HOURLY' | 'CONTRACT'
export type EmployeeRole = 'super_admin' | 'hr_admin' | 'manager' | 'employee'

export interface IEmployee {
  id: string
  full_name: string
  email: string
  phone: string
  employee_type: EmployeeType
  role: EmployeeRole
  department_id: string
  is_active: boolean
  face_enrolled: boolean
  created_at: string
  updated_at: string
}

export interface IEmployeeCreate {
  full_name: string
  email: string
  phone: string
  employee_type: EmployeeType
  role: EmployeeRole
  department_id: string
  password: string
}

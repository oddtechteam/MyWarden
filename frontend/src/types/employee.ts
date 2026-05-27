export type UserRole = 'super_admin' | 'hr_admin' | 'manager' | 'employee'
export type EmployeeType = 'FULL_TIME' | 'HOURLY' | 'CONTRACT'

export interface IDepartmentBrief {
  id: string
  name: string
}

export interface IEmployee {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  job_title: string | null
  role: UserRole
  employee_type: EmployeeType
  department_id: string | null
  department: IDepartmentBrief | null
  join_date: string | null
  base_salary: string | null
  face_enrolled: boolean
  is_active: boolean
  created_at: string
}

export interface IEmployeeCreate {
  email: string
  password: string
  full_name: string
  phone?: string
  job_title?: string
  role: UserRole
  employee_type: EmployeeType
  department_id?: string
  join_date?: string
  base_salary?: number
}

export interface IEmployeeUpdate {
  full_name?: string
  phone?: string
  job_title?: string
  role?: UserRole
  employee_type?: EmployeeType
  department_id?: string
  join_date?: string
  base_salary?: number
}

export interface IEmployeeListResponse {
  items: IEmployee[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface IDepartment {
  id: string
  name: string
  description: string | null
  is_active: boolean
}

export interface IUser {
  id: string
  email: string
  role: 'super_admin' | 'hr_admin' | 'manager' | 'employee'
  full_name?: string  // added in Phase 1 Part 3
}

export interface ILoginRequest {
  email: string
  password: string
}

export interface ITokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export type Role = 'patient' | 'receptionist' | 'doctor' | 'admin' | 'referrer'

export type Gender = 'female' | 'male' | 'other' | 'prefer_not_to_say'

export type AccountType = 'patient' | 'referrer'

export interface PatientProfile {
  patient_id: string
  date_of_birth: string | null
  gender: Gender | null
  city: string | null
}

export interface ReferrerProfile {
  referrer_id: string
  qualification: string | null
  registration_number: string | null
  clinic_name: string | null
  city: string | null
  is_verified: boolean
}

export interface User {
  id: string
  email: string
  role: Role
  full_name: string
  phone: string | null
  email_verified: boolean
  email_verified_at: string | null
  last_login_at: string | null
  created_at: string | null
  profile: PatientProfile | ReferrerProfile | null
}

export interface UserResponse {
  user: User
}

export interface CsrfResponse {
  csrf_token: string
  header: string
}

export interface LoginRequest {
  email: string
  password: string
  remember: boolean
}

interface RegisterBase {
  full_name: string
  email: string
  phone: string
  password: string
  password_confirmation: string
  consent: boolean
}

export interface PatientRegisterRequest extends RegisterBase {
  account_type: 'patient'
  date_of_birth?: string
  gender?: Gender | ''
  city?: string
}

export interface ReferrerRegisterRequest extends RegisterBase {
  account_type: 'referrer'
  qualification: string
  registration_number: string
  clinic_name: string
  city: string
}

export type RegisterRequest = PatientRegisterRequest | ReferrerRegisterRequest

export interface UpdateProfileRequest {
  full_name?: string
  phone?: string
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ResetPasswordRequest {
  token: string
  password: string
  password_confirmation: string
}

export interface ChangePasswordRequest {
  current_password: string
  password: string
  password_confirmation: string
}

export interface VerifyEmailResponse {
  message: string
  user: User | null
}

export interface LogoutEverywhereResponse {
  message: string
  revoked_tokens: number
}

export interface DashboardResponse {
  area: Role
  title: string
  role: Role
  widgets: unknown[]
}

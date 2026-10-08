import type { MessageResponse } from '../types/api'
import type {
  ChangePasswordRequest,
  DashboardResponse,
  ForgotPasswordRequest,
  LoginRequest,
  LogoutEverywhereResponse,
  RegisterRequest,
  ResetPasswordRequest,
  Role,
  UpdateProfileRequest,
  UserResponse,
  VerifyEmailResponse,
} from '../types/auth'
import { api, resetCsrfToken } from './client'

export const authApi = {
  me: () => api.get<UserResponse>('/auth/me', { skipUnauthorizedHandler: true }),
  login: (payload: LoginRequest) => api.post<UserResponse>('/auth/login', payload, { skipUnauthorizedHandler: true }),
  register: (payload: RegisterRequest) => api.post<UserResponse>('/auth/register', payload),
  logout: async () => {
    const result = await api.post<MessageResponse>('/auth/logout')
    resetCsrfToken()
    return result
  },
  logoutEverywhere: async () => {
    const result = await api.delete<LogoutEverywhereResponse>('/auth/sessions')
    resetCsrfToken()
    return result
  },
  updateProfile: (payload: UpdateProfileRequest) => api.patch<UserResponse>('/auth/me', payload),
  forgotPassword: (payload: ForgotPasswordRequest) => api.post<MessageResponse>('/auth/password/forgot', payload),
  resetPassword: (payload: ResetPasswordRequest) => api.post<MessageResponse>('/auth/password/reset', payload),
  changePassword: (payload: ChangePasswordRequest) => api.put<MessageResponse>('/auth/password', payload),
  verifyEmail: (token: string) => api.post<VerifyEmailResponse>('/auth/email/verify', { token }),
  resendVerification: () => api.post<MessageResponse>('/auth/email/resend'),
  dashboard: (area: Role) => api.get<DashboardResponse>(`/dashboards/${area}`),
}

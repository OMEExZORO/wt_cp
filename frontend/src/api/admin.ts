import type {
  AdminBranch,
  AdminCategory,
  AdminChecklistItem,
  AdminFaq,
  AdminReview,
  AdminScanType,
  AdminSlot,
  AdminUser,
  AuditResponse,
  GenerateSlotsResult,
  MyReview,
  MyReviewsResponse,
  ReviewStatus,
  ReviewsAdminResponse,
  ScanTypesResponse,
  SettingsResponse,
  SlotsResponse,
  StatsResponse,
  UsersResponse,
} from '../types/admin'
import type { MessageResponse } from '../types/api'
import { api } from './client'

export type Query = Record<string, string | number | boolean | undefined | null>
export type Payload = Record<string, unknown>

export function toQuery(query: Query = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value))
    }
  }
  const text = params.toString()
  return text === '' ? '' : `?${text}`
}

export const adminApi = {
  stats: (days?: number) => api.get<StatsResponse>(`/admin/stats${toQuery({ days })}`),
  auditLog: (query: Query) => api.get<AuditResponse>(`/admin/audit-log${toQuery(query)}`),

  users: (query: Query) => api.get<UsersResponse>(`/admin/users${toQuery(query)}`),
  createUser: (body: Payload) => api.post<AdminUser>('/admin/users', body),
  updateUser: (id: string, body: Payload) => api.patch<AdminUser>(`/admin/users/${id}`, body),
  sendPasswordReset: (id: string) => api.post<MessageResponse>(`/admin/users/${id}/password-reset`),

  branches: () => api.get<{ branches: AdminBranch[] }>('/admin/branches'),
  createBranch: (body: Payload) => api.post<AdminBranch>('/admin/branches', body),
  updateBranch: (id: string, body: Payload) => api.put<AdminBranch>(`/admin/branches/${id}`, body),
  deleteBranch: (id: string) => api.delete<void>(`/admin/branches/${id}`),

  categories: () => api.get<{ categories: AdminCategory[] }>('/admin/scan-categories'),
  createCategory: (body: Payload) => api.post<AdminCategory>('/admin/scan-categories', body),
  updateCategory: (id: string, body: Payload) => api.put<AdminCategory>(`/admin/scan-categories/${id}`, body),
  deleteCategory: (id: string) => api.delete<void>(`/admin/scan-categories/${id}`),

  scanTypes: (query: Query) => api.get<ScanTypesResponse>(`/admin/scan-types${toQuery(query)}`),
  createScanType: (body: Payload) => api.post<AdminScanType>('/admin/scan-types', body),
  updateScanType: (id: string, body: Payload) => api.put<AdminScanType>(`/admin/scan-types/${id}`, body),
  deleteScanType: (id: string) => api.delete<void>(`/admin/scan-types/${id}`),

  checklistItems: (query: Query) => api.get<{ items: AdminChecklistItem[] }>(`/admin/checklist-items${toQuery(query)}`),
  createChecklistItem: (body: Payload) => api.post<AdminChecklistItem>('/admin/checklist-items', body),
  updateChecklistItem: (id: string, body: Payload) => api.put<AdminChecklistItem>(`/admin/checklist-items/${id}`, body),
  deleteChecklistItem: (id: string) => api.delete<void>(`/admin/checklist-items/${id}`),

  slots: (query: Query) => api.get<SlotsResponse>(`/admin/slots${toQuery(query)}`),
  updateSlot: (id: string, body: Payload) => api.patch<AdminSlot>(`/admin/slots/${id}`, body),
  deleteSlot: (id: string) => api.delete<void>(`/admin/slots/${id}`),
  generateSlots: (body: Payload) => api.post<GenerateSlotsResult>('/admin/slots/generate', body),

  settings: () => api.get<SettingsResponse>('/admin/settings'),
  updateSettings: (settings: Record<string, string | null>) => api.patch<SettingsResponse>('/admin/settings', { settings }),
  uploadDoctorPhoto: (file: File) => {
    const form = new FormData()
    form.append('photo', file)
    return api.post<{ photo_url: string }>('/admin/doctor/photo', form)
  },
  removeDoctorPhoto: () => api.delete<void>('/admin/doctor/photo'),

  faqs: () => api.get<{ faqs: AdminFaq[] }>('/admin/faqs'),
  createFaq: (body: Payload) => api.post<AdminFaq>('/admin/faqs', body),
  updateFaq: (id: string, body: Payload) => api.put<AdminFaq>(`/admin/faqs/${id}`, body),
  deleteFaq: (id: string) => api.delete<void>(`/admin/faqs/${id}`),

  reviews: (query: Query) => api.get<ReviewsAdminResponse>(`/admin/reviews${toQuery(query)}`),
  createGoogleReview: (body: Payload) => api.post<AdminReview>('/admin/reviews', body),
  updateGoogleReview: (id: string, body: Payload) => api.put<AdminReview>(`/admin/reviews/${id}`, body),
  moderateReview: (id: string, status: ReviewStatus, moderationNote?: string) =>
    api.patch<AdminReview>(`/admin/reviews/${id}`, { status, moderation_note: moderationNote ?? null }),
}

export const reviewsApi = {
  mine: () => api.get<MyReviewsResponse>('/reviews/mine'),
  submit: (body: Payload) => api.post<MyReview>('/reviews', body),
}

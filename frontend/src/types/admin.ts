import type { Role } from './auth'

export type AdminModality = 'USG' | 'CT' | 'BIOPSY'
export type ReviewStatus = 'pending' | 'approved' | 'rejected'

export interface Pagination {
  page: number
  per_page: number
  total: number
}

export interface AdminUser {
  id: string
  email: string
  full_name: string
  phone: string | null
  role: Role
  is_active: boolean
  email_verified: boolean
  last_login_at: string | null
  created_at: string | null
}

export interface UsersResponse {
  users: AdminUser[]
  pagination: Pagination
}

export interface AdminBranch {
  id: string
  slug: string
  name: string
  address_line: string
  landmark: string | null
  area: string | null
  city: string
  state: string
  postal_code: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  opening_hours: string | null
  maps_url: string | null
  maps_embed_url: string | null
  latitude: number | null
  longitude: number | null
  is_placeholder: boolean
  is_active: boolean
  sort_order: number
}

export interface AdminCategory {
  id: string
  parent_id: string | null
  parent_name: string | null
  slug: string
  modality: AdminModality
  name: string
  tagline: string | null
  description: string | null
  sort_order: number
  is_active: boolean
}

export interface AdminScanType {
  id: string
  category_id: string
  category_name: string | null
  slug: string
  modality: AdminModality
  name: string
  short_description: string
  preparation_tips: string
  duration_minutes: number
  fee_inr: number | null
  is_bookable_online: boolean
  is_active: boolean
  sort_order: number
}

export interface ScanTypesResponse {
  scan_types: AdminScanType[]
  pagination: Pagination
}

export interface AdminChecklistItem {
  id: string
  scan_type_id: string | null
  scan_type_name: string | null
  modality: AdminModality | null
  code: string
  question: string
  help_text: string | null
  answer_type: 'yes_no' | 'yes_no_unsure' | 'text' | 'date'
  is_required: boolean
  attention_answers: string[]
  sort_order: number
  is_active: boolean
}

export interface AdminFaq {
  id: string
  question: string
  answer: string
  category: 'general' | 'booking' | 'preparation' | 'reports' | 'privacy'
  sort_order: number
  is_published: boolean
}

export interface AdminSlot {
  id: string
  branch_id: string
  branch_name: string | null
  modality: AdminModality
  slot_date: string
  start_time: string
  end_time: string
  capacity: number
  booked_count: number
  is_blocked: boolean
}

export interface SlotsResponse {
  slots: AdminSlot[]
  pagination: Pagination
}

export interface GenerateSlotsResult {
  candidates: number
  inserted: number
  skipped_existing: number
  dry_run: boolean
}

export interface AdminSetting {
  key: string
  value: string | null
  type: 'string' | 'text' | 'url' | 'phone' | 'email' | 'json' | 'image'
  group: string
  label: string
  is_public: boolean
  is_placeholder: boolean
  is_editable: boolean
  is_required: boolean
  updated_at: string | null
}

export interface SettingsResponse {
  settings: AdminSetting[]
}

export interface AdminReview {
  id: string
  display_name: string
  rating: number
  body: string
  status: ReviewStatus
  verified_visit: boolean
  is_demo: boolean
  moderation_note: string | null
  moderated_at: string | null
  created_at: string | null
}

export interface ReviewsAdminResponse {
  reviews: AdminReview[]
  pagination: Pagination
}

export interface AuditEntry {
  id: number
  actor_user_id: string | null
  actor_name: string | null
  actor_role: Role | null
  action: string
  entity_type: string | null
  entity_id: string | null
  ip_address: string | null
  metadata: Record<string, unknown>
  created_at: string | null
}

export interface AuditResponse {
  entries: AuditEntry[]
  pagination: Pagination
}

export interface StatsResponse {
  window: { from: string; to: string; days: number }
  per_day_per_branch: { date: string; branch_id: string; branch_name: string; total: number }[]
  daily_totals: { date: string; total: number }[]
  by_status: { status: string; total: number }[]
  by_modality: { modality: string; total: number }[]
  appointments_in_window: number
  pending_reviews: number
}

export interface MyReview {
  id: string
  display_name: string
  rating: number
  body: string
  status: ReviewStatus
  verified_visit: boolean
  created_at: string | null
}

export interface EligibleAppointment {
  id: string
  reference_code: string
  slot_date: string
  scan_name: string
  branch_name: string
}

export interface MyReviewsResponse {
  reviews: MyReview[]
  eligible_appointments: EligibleAppointment[]
}

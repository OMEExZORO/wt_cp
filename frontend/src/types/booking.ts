import type { Modality } from './public'

export type AppointmentStatus = 'pending' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'

export type Urgency = 'Routine' | 'Priority' | 'Urgent'

export const URGENCIES: Urgency[] = ['Routine', 'Priority', 'Urgent']

export type ChecklistAnswerType = 'yes_no' | 'yes_no_unsure' | 'date' | 'text'

export type SlotStatus = 'ok' | 'full' | 'blocked' | 'past' | 'wrong_modality' | 'branch_inactive'

export interface Slot {
  id: string
  branch_id: string
  modality: Modality
  date: string
  start_time: string
  end_time: string
  starts_at: string
  capacity: number
  booked_count: number
  remaining: number
  is_blocked: boolean
  is_available: boolean
  status: SlotStatus
}

export interface BranchRef {
  id: string
  name: string
  slug: string
}

export interface SlotSuggestion {
  kind: 'other_branch' | 'same_branch' | 'any_branch'
  branch: BranchRef
  slot: Slot
}

export interface AvailabilityResponse {
  date: string
  branch: BranchRef
  scan_type: { id: string; name: string; modality: Modality }
  slots: Slot[]
  summary: { total: number; available: number; branch_full: boolean; no_sessions: boolean }
  suggestion: SlotSuggestion | null
}

export interface DaySummary {
  date: string
  slot_count: number
  remaining: number
}

export interface DaysResponse {
  from: string
  to: string
  days: DaySummary[]
}

export interface NextAvailableResponse {
  suggestion: SlotSuggestion | null
}

export interface ChecklistItem {
  id: string
  code: string
  question: string
  help_text: string | null
  answer_type: ChecklistAnswerType
  is_required: boolean
}

export interface ChecklistResponse {
  scan_type: {
    id: string
    name: string
    slug: string
    modality: Modality
    preparation_tips: string
    is_bookable_online: boolean
  }
  items: ChecklistItem[]
}

export interface AppointmentBranch extends BranchRef {
  address: string
  phone: string | null
  maps_url: string | null
}

export interface AppointmentChecklistAnswer {
  checklist_item_id: string
  code: string
  question: string
  answer: string
  needs_attention: boolean
}

export interface AttentionFlag {
  code: string
  question: string
  answer: string
}

export interface Appointment {
  id: string
  reference_code: string
  status: AppointmentStatus
  urgency: Urgency
  starts_at: string
  ends_at: string
  slot: { id: string; date: string; start_time: string; end_time: string }
  branch: AppointmentBranch
  scan_type: { id: string; name: string; slug: string; modality: Modality; preparation_tips: string }
  patient: { id: string; full_name: string; phone?: string | null; email?: string | null }
  patient_notes: string | null
  needs_attention: boolean
  attention_count: number
  booked_by_staff: boolean
  created_at: string | null
  rescheduled_at: string | null
  checked_in_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  can_cancel: boolean
  can_reschedule: boolean
  calendar: { ics_path: string; google_url: string | null }
  attention?: AttentionFlag[]
  checklist?: AppointmentChecklistAnswer[]
}

export interface AppointmentListResponse {
  appointments: Appointment[]
}

export interface AppointmentResponse {
  appointment: Appointment
  email_sent?: boolean
}

export type AppointmentScope = 'upcoming' | 'past' | 'all'

export interface StaffAppointmentFilters {
  date?: string
  branch_id?: string
  status?: AppointmentStatus
  urgency?: Urgency
  per_page?: number
}

export interface CreateAppointmentRequest {
  scan_type_id: string
  slot_id: string
  consent: boolean
  patient_notes?: string
  answers: Record<string, string>
  patient_id?: string
  patient_full_name?: string
  patient_phone?: string
  urgency?: Urgency
}

export type StatusUpdate = { status: 'checked_in' | 'in_progress' | 'completed' | 'no_show' } | { urgency: Urgency }

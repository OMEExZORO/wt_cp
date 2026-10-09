import type { ReportSummary } from './report'

export type ReferralStatus = 'submitted' | 'accepted' | 'scheduled' | 'completed' | 'report_ready' | 'declined' | 'cancelled'

export type ReferralUrgency = 'Routine' | 'Priority' | 'Urgent'

export interface Referral {
  id: string
  reference_code: string
  patient_name: string
  patient_phone: string | null
  patient_email: string | null
  scan_type: { id: string; name: string; modality: string } | null
  preferred_branch: { id: string; name: string } | null
  urgency: ReferralUrgency
  status: ReferralStatus
  status_changed_at: string
  created_at: string
  appointment: { id: string; reference_code: string; status: string; date: string; time: string | null } | null
  clinical_notes: string | null
  referrer?: { name: string; clinic_name: string | null }
  reports: ReportSummary[]
}

export interface ReferralsResponse {
  referrals: Referral[]
}

export interface ReferralResponse {
  referral: Referral
}

export interface CreateReferralRequest {
  patient_name: string
  patient_phone: string
  patient_email?: string
  scan_type_id: string
  urgency: ReferralUrgency
  clinical_notes?: string
}

export interface UpdateReferralRequest {
  status?: Exclude<ReferralStatus, 'submitted'>
  appointment_id?: string
}

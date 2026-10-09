export type ReportStatus = 'draft' | 'final' | 'amended'

export type ReportMimeType = 'application/pdf' | 'image/jpeg' | 'image/png'

export interface ReportSummary {
  id: string
  title: string
  status: ReportStatus
  mime_type: ReportMimeType
  size_bytes: number
  original_filename: string
  is_critical: boolean
  patient: { id: string; name: string }
  appointment: { id: string; reference_code: string; scan_name: string; date: string }
  released_at: string | null
  created_at: string
  updated_at: string
}

export interface ReportDetail extends ReportSummary {
  uploaded_by: string | null
  has_referrer: boolean
  notes?: string | null
  impression?: string | null
}

export interface ReportsResponse {
  reports: ReportSummary[]
}

export interface ReportResponse {
  report: ReportDetail
}

export interface ReportListFilters {
  q?: string
  status?: ReportStatus
  patient_id?: string
  appointment_id?: string
  per_page?: number
}

export interface UploadReportInput {
  appointment_id: string
  title: string
  notes: string
  impression: string
  status: 'draft' | 'final'
  file: File
}

export interface UpdateReportInput {
  title?: string
  notes?: string | null
  impression?: string | null
  status?: ReportStatus
}

export interface StaffAppointmentOption {
  id: string
  reference_code: string
  status: string
  patient: { full_name: string }
  scan_type: { name: string }
  slot: { date: string; start_time: string }
}

export interface StaffAppointmentsResponse {
  appointments: StaffAppointmentOption[]
}

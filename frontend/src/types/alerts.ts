export type AlertStatus = 'open' | 'notified' | 'escalated' | 'acknowledged' | 'resolved' | 'cancelled'

export type Urgency = 'Routine' | 'Priority' | 'Urgent'

export type WaitLevel = 'ok' | 'warning' | 'overdue'

export interface AlertBanner {
  id: string
  status: AlertStatus
  audience: 'patient' | 'referrer'
  title: string
  message: string
  patient_name: string | null
  scan_name: string
  reference_code: string
  requires_acknowledgement: boolean
  created_at: string
}

export interface MyAlertsResponse {
  alerts: AlertBanner[]
}

export interface AcknowledgeResponse {
  alert_id: string
  status: AlertStatus
  acknowledged_at: string | null
}

export interface StaffAlert {
  id: string
  status: AlertStatus
  escalation_level: number
  notify_count: number
  red_flag: boolean
  staff_flagged_at: string | null
  patient_name: string
  patient_phone: string | null
  referrer_name: string | null
  scan_name: string
  reference_code: string
  report_id: string
  raised_by_name: string | null
  created_at: string
  last_notified_at: string | null
  next_escalation_at: string | null
  acknowledged_at: string | null
  acknowledged_by_name: string | null
  resolved_at: string | null
  resolved_by_name: string | null
  resolution_note: string | null
}

export interface StaffAlertsResponse {
  alerts: StaffAlert[]
}

export interface AlertEventItem {
  id: number
  event_type: string
  from_status: AlertStatus | null
  to_status: AlertStatus | null
  actor_type: 'user' | 'system'
  actor_name: string | null
  actor_role: string | null
  channel: string | null
  details: Record<string, unknown>
  created_at: string
}

export interface AlertEventsResponse {
  alert: StaffAlert
  events: AlertEventItem[]
}

export interface ResolveResponse {
  alert: StaffAlert
}

export interface FlagCriticalResponse {
  alert: StaffAlert
  note_stored: boolean
}

export interface QueueItem {
  appointment_id: string
  reference_code: string
  patient_name: string
  scan_name: string
  modality: string
  branch_name: string
  urgency: Urgency
  is_referred: boolean
  waiting_since: string | null
  waiting_minutes: number
  wait_level: WaitLevel
}

export interface RecentReport {
  report_id: string
  title: string
  status: string
  is_critical: boolean
  reference_code: string
  patient_name: string
  scan_name: string
  alert_id: string | null
  alert_status: AlertStatus | null
  created_at: string
}

export interface DoctorQueueResponse {
  queue: QueueItem[]
  recent_reports: RecentReport[]
  generated_at: string
}

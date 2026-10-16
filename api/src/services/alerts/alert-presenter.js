import { toIso } from '../../core/time.js'
import { isRedFlagged } from './alert-workflow.js'

export const banner = (row, audience, timezone) => {
  const forPatient = audience === 'patient'
  return {
    id: row.id,
    status: row.status,
    audience,
    title: 'Important: your report needs attention',
    message: forPatient
      ? `A finding in your ${row.scan_name} report (reference ${row.reference_code}) needs urgent attention. Please acknowledge this alert and contact the centre as soon as possible.`
      : `A finding in the ${row.scan_name} report of your patient ${row.patient_name} (reference ${row.reference_code}) needs urgent attention. Please acknowledge this alert and contact the centre.`,
    patient_name: forPatient ? null : row.patient_name,
    scan_name: row.scan_name,
    reference_code: row.reference_code,
    requires_acknowledgement: true,
    created_at: toIso(row.created_at, timezone),
  }
}

export const staff = (row, timezone) => ({
  id: row.id,
  status: row.status,
  escalation_level: Number(row.escalation_level),
  notify_count: Number(row.notify_count),
  red_flag: isRedFlagged(row),
  staff_flagged_at: toIso(row.staff_flagged_at, timezone),
  patient_name: row.patient_name,
  patient_phone: row.patient_phone,
  referrer_name: row.referrer_name,
  scan_name: row.scan_name,
  reference_code: row.reference_code,
  report_id: row.report_id,
  raised_by_name: row.raised_by_name,
  created_at: toIso(row.created_at, timezone),
  last_notified_at: toIso(row.last_notified_at, timezone),
  next_escalation_at: toIso(row.next_escalation_at, timezone),
  acknowledged_at: toIso(row.acknowledged_at, timezone),
  acknowledged_by_name: row.acknowledged_by_name,
  resolved_at: toIso(row.resolved_at, timezone),
  resolved_by_name: row.resolved_by_name,
  resolution_note: row.resolution_note,
})

export const event = (row, timezone) => {
  let details = row.details
  if (typeof details === 'string') {
    try {
      details = JSON.parse(details)
    } catch {
      details = null
    }
  }
  const isMap = details !== null && typeof details === 'object'
  const isEmpty = isMap && !Array.isArray(details) && Object.keys(details).length === 0
  return {
    id: Number(row.id),
    event_type: row.event_type,
    from_status: row.from_status,
    to_status: row.to_status,
    actor_type: row.actor_type,
    actor_name: row.actor_name,
    actor_role: row.actor_role,
    channel: row.channel,
    details: isEmpty ? [] : isMap ? details : {},
    created_at: toIso(row.created_at, timezone),
  }
}

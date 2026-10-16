import { toIso } from '../../core/time.js'
import { ACTIVE_STATUSES } from '../../models/appointment.js'
import { flag } from '../../models/flag.js'
import { buildGoogleLink } from './google-calendar-link.js'
import { buildEvent } from './ics-calendar.js'
import { at, atom } from './slot-capacity.js'

const STAFF_BOOKER_ROLES = ['receptionist', 'admin', 'doctor']

export const appointmentTitle = (row) => `${row.scan_name} at ${row.branch_name}`

export const appointmentLocation = (row) => {
  const parts = [String(row.branch_name)]
  const address = String(row.branch_address_line ?? '').trim()
  const postal = String(row.branch_postal_code ?? '').trim()
  if (address !== '' && !address.startsWith('TODO')) {
    parts.push(postal !== '' ? `${address} - ${postal.slice(0, 3)} ${postal.slice(3)}` : address)
  }
  return parts.join(', ')
}

export const calendarDetails = (row) => {
  const lines = [`Booking reference: ${row.reference_code}`, `Scan: ${row.scan_name}`]
  const tips = String(row.preparation_tips ?? '').trim()
  if (tips !== '') lines.push(`Preparation: ${tips}`)
  lines.push("Please bring your doctor's referral, previous reports and a photo ID.")
  lines.push('This is not for emergencies. In an emergency call 112.')
  return lines.join('\n')
}

export const appointmentIcs = (row, now, domain, portalUrl = '') =>
  buildEvent({
    uid: `${row.id}@${domain}`,
    sequence: Number.parseInt(row.calendar_sequence ?? 0, 10) || 0,
    dtstamp: now,
    start: at(row.slot_date, row.start_time),
    end: at(row.slot_date, row.end_time),
    summary: appointmentTitle(row),
    description: calendarDetails(row),
    location: appointmentLocation(row),
    url: portalUrl,
    status: row.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED',
  })

export const presentAppointment = (row, now, forStaff, timezone, checklist = [], attention = []) => {
  const start = at(row.slot_date, row.start_time)
  const end = at(row.slot_date, row.end_time)
  const status = String(row.status)
  const active = ACTIVE_STATUSES.includes(status)
  const started = start.getTime() <= now.getTime()
  const location = appointmentLocation(row)
  const attentionCount = Number.parseInt(row.attention_count ?? 0, 10) || 0
  const data = {
    id: row.id,
    reference_code: row.reference_code,
    status,
    urgency: row.urgency,
    starts_at: atom(start),
    ends_at: atom(end),
    slot: {
      id: row.slot_id,
      date: String(row.slot_date),
      start_time: String(row.start_time).slice(0, 5),
      end_time: String(row.end_time).slice(0, 5),
    },
    branch: {
      id: row.branch_id,
      name: row.branch_name,
      slug: row.branch_slug,
      address: location,
      phone: row.branch_phone ?? null,
      maps_url: row.branch_maps_url ?? null,
    },
    scan_type: {
      id: row.scan_type_id,
      name: row.scan_name,
      slug: row.scan_slug,
      modality: row.modality,
      preparation_tips: row.preparation_tips,
    },
    patient: {
      id: row.patient_id,
      full_name: row.patient_name,
    },
    patient_notes: row.patient_notes,
    needs_attention: attentionCount > 0,
    attention_count: attentionCount,
    booked_by_staff: STAFF_BOOKER_ROLES.includes(row.booked_by_role ?? null),
    created_at: toIso(row.created_at, timezone),
    rescheduled_at: toIso(row.rescheduled_at ?? null, timezone),
    checked_in_at: toIso(row.checked_in_at, timezone),
    completed_at: toIso(row.completed_at, timezone),
    cancelled_at: toIso(row.cancelled_at, timezone),
    cancellation_reason: row.cancellation_reason,
    can_cancel: active && (forStaff || !started),
    can_reschedule: active && (forStaff || !started),
    calendar: {
      ics_path: `/appointments/${row.id}/ics`,
      google_url:
        status === 'cancelled' ? null : buildGoogleLink(appointmentTitle(row), start, end, calendarDetails(row), location),
    },
  }
  if (forStaff) {
    data.patient.phone = row.patient_phone
    data.patient.email = row.patient_email
    data.attention = attention
  }
  if (checklist.length > 0) {
    data.checklist = checklist.map((answer) => ({
      checklist_item_id: answer.checklist_item_id,
      code: answer.code,
      question: answer.question,
      answer: answer.answer,
      needs_attention: flag(answer.needs_attention),
    }))
  }
  return data
}

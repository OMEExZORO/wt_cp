import { flag } from './flag.js'
import { Model } from './model.js'
import { ScanType } from './scan-type.js'

export const STATUSES = ['pending', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show']
export const ACTIVE_STATUSES = ['pending', 'confirmed']
export const URGENCIES = ['Routine', 'Priority', 'Urgent']

const DETAIL = `SELECT a.id, a.reference_code, a.patient_id, a.slot_id, a.branch_id, a.scan_type_id, a.referral_id,
                a.booked_by_user_id, a.status, a.urgency, a.patient_notes, a.consent_given_at, a.checked_in_at, a.completed_at,
                a.cancelled_at, a.cancellation_reason, a.reminder_sent_at, a.calendar_sequence, a.rescheduled_at,
                a.urgency_updated_at, a.created_at, a.updated_at,
                s.slot_date, s.start_time, s.end_time, s.modality,
                b.name AS branch_name, b.slug AS branch_slug, b.address_line AS branch_address_line, b.landmark AS branch_landmark,
                b.area AS branch_area, b.city AS branch_city, b.state AS branch_state, b.postal_code AS branch_postal_code,
                b.phone AS branch_phone, b.maps_url AS branch_maps_url,
                t.name AS scan_name, t.slug AS scan_slug, t.preparation_tips, t.duration_minutes,
                p.full_name AS patient_name, p.phone AS patient_phone, p.user_id AS patient_user_id,
                COALESCE(u.email, p.email) AS patient_email,
                bu.role AS booked_by_role,
                (SELECT count(*) FROM appointment_checklist_answers ca WHERE ca.appointment_id = a.id AND ca.needs_attention) AS attention_count
            FROM appointments a
            JOIN slots s ON s.id = a.slot_id
            JOIN branches b ON b.id = a.branch_id
            JOIN scan_types t ON t.id = a.scan_type_id
            JOIN patients p ON p.id = a.patient_id
            LEFT JOIN users u ON u.id = p.user_id
            LEFT JOIN users bu ON bu.id = a.booked_by_user_id`

const URGENCY_RANK = "CASE a.urgency WHEN 'Urgent' THEN 0 WHEN 'Priority' THEN 1 ELSE 2 END"

const scopeClause = (scope, today, nowTime, params) => {
  if (scope !== 'upcoming' && scope !== 'past') return ''
  params.push(today, nowTime)
  const t = `$${params.length - 1}`
  const n = `$${params.length}`
  if (scope === 'upcoming') {
    return ` AND a.status IN ('pending', 'confirmed', 'checked_in', 'in_progress') AND (s.slot_date, s.end_time) >= (CAST(${t} AS date), CAST(${n} AS time))`
  }
  return ` AND (a.status IN ('completed', 'cancelled', 'no_show') OR (s.slot_date, s.end_time) < (CAST(${t} AS date), CAST(${n} AS time)))`
}

const present = (value) => value !== null && value !== undefined

const staffWhere = (filters, today, nowTime, params) => {
  let where = scopeClause(String(filters.scope ?? 'all'), today, nowTime, params)
  if (present(filters.date)) {
    params.push(filters.date)
    where += ` AND s.slot_date = CAST($${params.length} AS date)`
  }
  if (present(filters.from)) {
    params.push(filters.from)
    where += ` AND s.slot_date >= CAST($${params.length} AS date)`
  }
  if (present(filters.to)) {
    params.push(filters.to)
    where += ` AND s.slot_date <= CAST($${params.length} AS date)`
  }
  if (present(filters.branch_id)) {
    params.push(filters.branch_id)
    where += ` AND a.branch_id = $${params.length}`
  }
  if (present(filters.status)) {
    params.push(filters.status)
    where += ` AND a.status = $${params.length}`
  }
  if (present(filters.urgency)) {
    params.push(filters.urgency)
    where += ` AND a.urgency = $${params.length}`
  }
  if (present(filters.q)) {
    params.push(`%${ScanType.escapeLike(String(filters.q))}%`)
    const q = `$${params.length}`
    where += ` AND (p.full_name ILIKE ${q} OR a.reference_code ILIKE ${q} OR p.phone ILIKE ${q})`
  }
  return where
}

export class Appointment extends Model {
  static table = 'appointments'
  static fillable = [
    'reference_code', 'patient_id', 'slot_id', 'branch_id', 'scan_type_id', 'referral_id', 'booked_by_user_id',
    'rescheduled_from_id', 'status', 'urgency', 'patient_notes', 'consent_given_at', 'checked_in_at', 'completed_at',
    'cancelled_at', 'cancellation_reason', 'reminder_sent_at', 'calendar_sequence', 'rescheduled_at', 'urgency_updated_at',
  ]

  findDetailed(id) {
    return this.db.one(`${DETAIL} WHERE a.id = $1`, [id])
  }

  listForPatient(patientId, scope, today, nowTime) {
    const params = [patientId]
    const where = scopeClause(scope, today, nowTime, params)
    const order = scope === 'past' ? 's.slot_date DESC, s.start_time DESC' : 's.slot_date, s.start_time'
    return this.db.all(`${DETAIL} WHERE a.patient_id = $1${where} ORDER BY ${order} LIMIT 200`, params)
  }

  listForStaff(filters, today, nowTime, limit, offset) {
    const params = []
    const where = staffWhere(filters, today, nowTime, params)
    const order =
      (filters.scope ?? 'all') === 'past'
        ? 's.slot_date DESC, s.start_time DESC'
        : `s.slot_date, s.start_time, ${URGENCY_RANK}, a.created_at`
    params.push(limit, offset)
    return this.db.all(
      `${DETAIL} WHERE TRUE${where} ORDER BY ${order} LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    )
  }

  async countForStaff(filters, today, nowTime) {
    const params = []
    const where = staffWhere(filters, today, nowTime, params)
    const value = await this.db.value(
      `SELECT count(*) FROM appointments a JOIN slots s ON s.id = a.slot_id JOIN patients p ON p.id = a.patient_id WHERE TRUE${where}`,
      params,
    )
    return Number(value ?? 0)
  }

  lockForUpdate(id) {
    return this.db.one(
      `SELECT a.*, t.modality, s.slot_date, s.start_time, s.end_time
             FROM appointments a
             JOIN scan_types t ON t.id = a.scan_type_id
             JOIN slots s ON s.id = a.slot_id
             WHERE a.id = $1 FOR UPDATE OF a`,
      [id],
    )
  }

  async hasActiveInSlot(patientId, slotId, exceptId = null) {
    let sql = "SELECT EXISTS (SELECT 1 FROM appointments WHERE patient_id = $1 AND slot_id = $2 AND status <> 'cancelled'"
    const params = [patientId, slotId]
    if (exceptId !== null) {
      params.push(exceptId)
      sql += ' AND id <> $3'
    }
    return flag(await this.db.value(`${sql})`, params))
  }

  moveToSlot(id, slotId, branchId) {
    return this.db.execute(
      `UPDATE appointments
             SET slot_id = $1, branch_id = $2, rescheduled_at = now(), reminder_sent_at = NULL,
                 calendar_sequence = calendar_sequence + 1
             WHERE id = $3`,
      [slotId, branchId, id],
    )
  }

  markCancelled(id, reason) {
    return this.db.execute(
      `UPDATE appointments
             SET status = 'cancelled', cancelled_at = now(), cancellation_reason = $1, calendar_sequence = calendar_sequence + 1
             WHERE id = $2`,
      [reason, id],
    )
  }

  async applyStatus(id, status, urgency) {
    const sets = []
    const params = []
    if (status !== null) {
      params.push(status)
      sets.push(`status = $${params.length}`)
      if (status === 'checked_in') sets.push('checked_in_at = COALESCE(checked_in_at, now())')
      if (status === 'completed') {
        sets.push('completed_at = now()')
        sets.push('checked_in_at = COALESCE(checked_in_at, now())')
      }
    }
    if (urgency !== null) {
      params.push(urgency)
      sets.push(`urgency = $${params.length}`)
      sets.push('urgency_updated_at = now()')
    }
    if (sets.length === 0) return
    params.push(id)
    await this.db.execute(`UPDATE appointments SET ${sets.join(', ')} WHERE id = $${params.length}`, params)
  }

  async referenceExists(code) {
    return flag(await this.db.value('SELECT EXISTS (SELECT 1 FROM appointments WHERE reference_code = $1)', [code]))
  }
}

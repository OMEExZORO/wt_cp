import { escapeLike } from './report.js'
import { Model } from './model.js'

const DETAIL = `SELECT rf.id, rf.reference_code, rf.referrer_id, rf.patient_id, rf.patient_name, rf.patient_phone,
                rf.patient_email, rf.scan_type_id, rf.preferred_branch_id, rf.urgency, rf.status, rf.clinical_notes_encrypted,
                rf.status_changed_at, rf.created_at, rf.updated_at,
                rr.user_id AS referrer_user_id, rr.full_name AS referrer_name, rr.clinic_name AS referrer_clinic,
                t.name AS scan_name, t.modality AS scan_modality,
                b.name AS branch_name,
                ap.id AS appointment_id, ap.reference_code AS appointment_reference, ap.status AS appointment_status,
                ap.slot_date AS appointment_date, ap.start_time AS appointment_time
            FROM referrals rf
            JOIN referrers rr ON rr.id = rf.referrer_id
            LEFT JOIN scan_types t ON t.id = rf.scan_type_id
            LEFT JOIN branches b ON b.id = rf.preferred_branch_id
            LEFT JOIN LATERAL (
                SELECT a.id, a.reference_code, a.status, s.slot_date, s.start_time
                FROM appointments a JOIN slots s ON s.id = a.slot_id
                WHERE a.referral_id = rf.id AND a.status <> 'cancelled'
                ORDER BY s.slot_date DESC, s.start_time DESC LIMIT 1
            ) ap ON TRUE`

export class Referral extends Model {
  static table = 'referrals'
  static fillable = [
    'reference_code', 'referrer_id', 'patient_id', 'patient_name', 'patient_phone', 'patient_email', 'scan_type_id',
    'preferred_branch_id', 'urgency', 'status', 'clinical_notes_encrypted', 'status_changed_at',
  ]

  static STATUSES = ['submitted', 'accepted', 'scheduled', 'completed', 'report_ready', 'declined', 'cancelled']
  static STAFF_STATUSES = ['accepted', 'scheduled', 'completed', 'report_ready', 'declined', 'cancelled']
  static URGENCIES = ['Routine', 'Priority', 'Urgent']

  findDetailed(id) {
    return this.db.one(`${DETAIL} WHERE rf.id = $1`, [id])
  }

  list(filters, referrerId, limit, offset) {
    const { where, params } = this.scope(filters, referrerId)
    params.push(limit, offset)
    return this.db.all(
      `${DETAIL} WHERE TRUE${where} ORDER BY rf.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    )
  }

  async count(filters, referrerId) {
    const { where, params } = this.scope(filters, referrerId)
    return Number(await this.db.value(`SELECT count(*) FROM referrals rf WHERE TRUE${where}`, params))
  }

  async referenceExists(code) {
    return Boolean(await this.db.value('SELECT EXISTS (SELECT 1 FROM referrals WHERE reference_code = $1)', [code]))
  }

  linkAppointment(referralId, appointmentId) {
    return this.db.execute('UPDATE appointments SET referral_id = $1 WHERE id = $2', [referralId, appointmentId])
  }

  findScanType(id) {
    return this.db.one('SELECT * FROM scan_types WHERE id = $1', [id])
  }

  findActiveBranch(id) {
    return this.db.one('SELECT * FROM branches WHERE id = $1 AND is_active = TRUE', [id])
  }

  findAppointment(id) {
    return this.db.one('SELECT a.id, a.status, a.patient_id, a.referral_id FROM appointments a WHERE a.id = $1', [id])
  }

  scope(filters, referrerId) {
    let where = ''
    const params = []
    const bind = (value) => {
      params.push(value)
      return `$${params.length}`
    }
    if (referrerId !== null) where += ` AND rf.referrer_id = ${bind(referrerId)}`
    if (filters.status) where += ` AND rf.status = ${bind(filters.status)}`
    if (filters.q) {
      const q = bind(`%${escapeLike(filters.q)}%`)
      where += ` AND (rf.patient_name ILIKE ${q} OR rf.reference_code ILIKE ${q})`
    }
    return { where, params }
  }
}

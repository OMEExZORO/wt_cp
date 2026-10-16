import { Model } from './model.js'

const DETAIL = `SELECT r.id, r.appointment_id, r.patient_id, r.uploaded_by_user_id, r.title, r.original_filename,
                r.storage_path, r.mime_type, r.size_bytes, r.sha256, r.encryption_iv, r.encryption_tag, r.key_version,
                r.findings_encrypted, r.impression_encrypted, r.storage_driver, r.status, r.is_critical, r.released_at,
                r.deleted_at, r.created_at, r.updated_at,
                p.full_name AS patient_name, p.user_id AS patient_user_id,
                a.reference_code AS appointment_reference, a.referral_id, a.status AS appointment_status,
                s.slot_date, t.name AS scan_name,
                rr.user_id AS referrer_user_id, rf.referrer_id,
                uu.full_name AS uploaded_by_name
            FROM reports r
            JOIN patients p ON p.id = r.patient_id
            JOIN appointments a ON a.id = r.appointment_id
            JOIN slots s ON s.id = a.slot_id
            JOIN scan_types t ON t.id = a.scan_type_id
            LEFT JOIN referrals rf ON rf.id = a.referral_id
            LEFT JOIN referrers rr ON rr.id = rf.referrer_id
            LEFT JOIN users uu ON uu.id = r.uploaded_by_user_id`

export const escapeLike = (value) => String(value).replace(/[%_\\]/g, '\\$&')

export class Report extends Model {
  static table = 'reports'
  static fillable = [
    'appointment_id', 'patient_id', 'uploaded_by_user_id', 'title', 'original_filename', 'storage_path', 'mime_type',
    'size_bytes', 'sha256', 'encryption_iv', 'encryption_tag', 'key_version', 'findings_encrypted', 'impression_encrypted',
    'storage_driver', 'status', 'is_critical', 'released_at', 'deleted_at',
  ]

  static STATUSES = ['draft', 'final', 'amended']
  static RELEASED_STATUSES = ['final', 'amended']

  findAppointment(id) {
    return this.db.one('SELECT a.id, a.status, a.patient_id, a.referral_id FROM appointments a WHERE a.id = $1', [id])
  }

  findDetailed(id) {
    return this.db.one(`${DETAIL} WHERE r.id = $1 AND r.deleted_at IS NULL`, [id])
  }

  listVisible(user, filters, limit, offset) {
    const { where, params } = this.scope(user, filters)
    params.push(limit, offset)
    return this.db.all(
      `${DETAIL} WHERE r.deleted_at IS NULL${where} ORDER BY r.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    )
  }

  async countVisible(user, filters) {
    const { where, params } = this.scope(user, filters)
    return Number(
      await this.db.value(
        `SELECT count(*) FROM reports r
             JOIN patients p ON p.id = r.patient_id
             JOIN appointments a ON a.id = r.appointment_id
             LEFT JOIN referrals rf ON rf.id = a.referral_id
             LEFT JOIN referrers rr ON rr.id = rf.referrer_id
             WHERE r.deleted_at IS NULL${where}`,
        params,
      ),
    )
  }

  releasedForReferral(referralId) {
    return this.db.all(
      `${DETAIL} WHERE r.deleted_at IS NULL AND a.referral_id = $1 AND r.status IN ('final', 'amended') ORDER BY r.created_at DESC`,
      [referralId],
    )
  }

  allForReferral(referralId) {
    return this.db.all(`${DETAIL} WHERE r.deleted_at IS NULL AND a.referral_id = $1 ORDER BY r.created_at DESC`, [referralId])
  }

  markDeleted(id) {
    return this.db.execute('UPDATE reports SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL', [id])
  }

  async hasReleasedForReferral(referralId) {
    return Boolean(
      await this.db.value(
        `SELECT EXISTS (SELECT 1 FROM reports r JOIN appointments a ON a.id = r.appointment_id
             WHERE a.referral_id = $1 AND r.deleted_at IS NULL AND r.status IN ('final', 'amended'))`,
        [referralId],
      ),
    )
  }

  scope(user, filters) {
    let where = ''
    const params = []
    const bind = (value) => {
      params.push(value)
      return `$${params.length}`
    }
    const role = String(user?.role ?? '')
    if (role === 'patient') {
      where += ` AND p.user_id = ${bind(user.id)} AND r.status IN ('final', 'amended')`
    } else if (role === 'referrer') {
      where += ` AND rr.user_id = ${bind(user.id)} AND r.status IN ('final', 'amended')`
    } else if (!['receptionist', 'doctor', 'admin'].includes(role)) {
      return { where: ' AND FALSE', params: [] }
    }
    if (filters.patient_id) where += ` AND r.patient_id = ${bind(filters.patient_id)}`
    if (filters.appointment_id) where += ` AND r.appointment_id = ${bind(filters.appointment_id)}`
    if (filters.status) where += ` AND r.status = ${bind(filters.status)}`
    if (filters.q) {
      const q = bind(`%${escapeLike(filters.q)}%`)
      where += ` AND (r.title ILIKE ${q} OR p.full_name ILIKE ${q} OR a.reference_code ILIKE ${q})`
    }
    if (filters.from) where += ` AND r.created_at >= CAST(${bind(filters.from)} AS date)`
    if (filters.to) where += ` AND r.created_at < CAST(${bind(filters.to)} AS date) + INTERVAL '1 day'`
    return { where, params }
  }
}

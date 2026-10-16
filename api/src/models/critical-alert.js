import { escapeLike } from './report.js'
import { Model } from './model.js'

const DETAIL = `SELECT ca.id, ca.report_id, ca.patient_id, ca.referrer_id, ca.status, ca.escalation_level, ca.notify_count,
                ca.last_notified_at, ca.next_escalation_at, ca.staff_flagged_at, ca.acknowledged_at, ca.acknowledged_by_user_id,
                ca.resolved_at, ca.resolved_by_user_id, ca.resolution_note, ca.created_at, ca.updated_at,
                ap.id AS appointment_id, ap.reference_code, t.name AS scan_name, rep.title AS report_title,
                p.full_name AS patient_name, p.phone AS patient_phone, COALESCE(pu.email, p.email) AS patient_email, p.user_id AS patient_user_id,
                ref.full_name AS referrer_name, ref.user_id AS referrer_user_id, ru.email AS referrer_email,
                (SELECT u.full_name FROM users u WHERE u.id = ca.raised_by_user_id) AS raised_by_name,
                (SELECT u.full_name FROM users u WHERE u.id = ca.acknowledged_by_user_id) AS acknowledged_by_name,
                (SELECT u.full_name FROM users u WHERE u.id = ca.resolved_by_user_id) AS resolved_by_name
            FROM critical_alerts ca
            JOIN reports rep ON rep.id = ca.report_id
            JOIN appointments ap ON ap.id = rep.appointment_id
            JOIN scan_types t ON t.id = ap.scan_type_id
            JOIN patients p ON p.id = ca.patient_id
            LEFT JOIN users pu ON pu.id = p.user_id
            LEFT JOIN referrers ref ON ref.id = ca.referrer_id
            LEFT JOIN users ru ON ru.id = ref.user_id`

export class CriticalAlert extends Model {
  static table = 'critical_alerts'
  static fillable = [
    'report_id', 'patient_id', 'referrer_id', 'raised_by_user_id', 'finding_summary_encrypted', 'status',
    'escalation_level', 'notify_count', 'last_notified_at', 'next_escalation_at', 'staff_flagged_at',
    'acknowledged_at', 'acknowledged_by_user_id', 'resolved_at', 'resolved_by_user_id', 'resolution_note',
  ]

  reportContext(reportId) {
    return this.db.one(
      `SELECT r.id AS report_id, r.title AS report_title, r.is_critical, r.deleted_at, r.patient_id, r.appointment_id,
                    a.reference_code, t.name AS scan_name, p.full_name AS patient_name, p.phone AS patient_phone,
                    COALESCE(pu.email, p.email) AS patient_email, p.user_id AS patient_user_id,
                    ref.id AS referrer_id, ref.full_name AS referrer_name, ref.user_id AS referrer_user_id, ru.email AS referrer_email
             FROM reports r
             JOIN appointments a ON a.id = r.appointment_id
             JOIN scan_types t ON t.id = a.scan_type_id
             JOIN patients p ON p.id = r.patient_id
             LEFT JOIN users pu ON pu.id = p.user_id
             LEFT JOIN referrals rf ON rf.id = a.referral_id
             LEFT JOIN referrers ref ON ref.id = rf.referrer_id
             LEFT JOIN users ru ON ru.id = ref.user_id
             WHERE r.id = $1`,
      [reportId],
    )
  }

  lockReport(reportId) {
    return this.db.one('SELECT id, is_critical, deleted_at FROM reports WHERE id = $1 FOR UPDATE', [reportId])
  }

  async hasActiveForReport(reportId) {
    return Boolean(
      await this.db.value(
        "SELECT EXISTS (SELECT 1 FROM critical_alerts WHERE report_id = $1 AND status NOT IN ('resolved', 'cancelled'))",
        [reportId],
      ),
    )
  }

  markReportCritical(reportId) {
    return this.db.execute('UPDATE reports SET is_critical = TRUE WHERE id = $1', [reportId])
  }

  findDetailed(id) {
    return this.db.one(`${DETAIL} WHERE ca.id = $1`, [id])
  }

  lockForUpdate(id) {
    return this.db.one('SELECT id, status FROM critical_alerts WHERE id = $1 FOR UPDATE', [id])
  }

  listUnacknowledgedForUser(userId, role) {
    const column = role === 'referrer' ? 'ref.user_id' : 'p.user_id'
    return this.db.all(
      `${DETAIL} WHERE ${column} = $1 AND ca.status IN ('open', 'notified', 'escalated') ORDER BY ca.created_at DESC LIMIT 50`,
      [userId],
    )
  }

  listForStaff(filters, limit, offset) {
    const { where, params } = this.staffWhere(filters)
    params.push(limit, offset)
    return this.db.all(
      `${DETAIL} WHERE TRUE${where}
             ORDER BY (CASE WHEN ca.staff_flagged_at IS NOT NULL AND ca.status IN ('open', 'notified', 'escalated') THEN 0 ELSE 1 END),
                (CASE WHEN ca.status IN ('open', 'notified', 'escalated') THEN 0 ELSE 1 END), ca.created_at DESC
               LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    )
  }

  async countForStaff(filters) {
    const { where, params } = this.staffWhere(filters)
    return Number(
      await this.db.value(`SELECT count(*) FROM critical_alerts ca JOIN patients p ON p.id = ca.patient_id WHERE TRUE${where}`, params),
    )
  }

  applyNotified(id, notifyCount, windowMinutes) {
    return this.db.execute(
      `UPDATE critical_alerts SET status = 'notified', notify_count = $2, last_notified_at = now(),
                    next_escalation_at = now() + make_interval(mins => $3)
             WHERE id = $1 AND status = 'open'`,
      [id, notifyCount, windowMinutes],
    )
  }

  applyAcknowledged(id, userId) {
    return this.db.execute(
      `UPDATE critical_alerts SET status = 'acknowledged', acknowledged_at = now(), acknowledged_by_user_id = $2,
                    next_escalation_at = NULL
             WHERE id = $1`,
      [id, userId],
    )
  }

  applyResolved(id, userId, note) {
    return this.db.execute(
      `UPDATE critical_alerts SET status = 'resolved', resolved_at = now(), resolved_by_user_id = $2,
                    resolution_note = $3, next_escalation_at = NULL
             WHERE id = $1`,
      [id, userId, note],
    )
  }

  staffWhere(filters) {
    let where = ''
    const params = []
    const bind = (value) => {
      params.push(value)
      return `$${params.length}`
    }
    const status = filters.status ?? null
    if (status === 'active') {
      where += " AND ca.status IN ('open', 'notified', 'escalated')"
    } else if (typeof status === 'string' && status !== '' && status !== 'all') {
      where += ` AND ca.status = ${bind(status)}`
    }
    if (filters.flagged) where += " AND ca.staff_flagged_at IS NOT NULL AND ca.status IN ('open', 'notified', 'escalated')"
    if (filters.q) where += ` AND p.full_name ILIKE ${bind(`%${escapeLike(filters.q)}%`)}`
    return { where, params }
  }
}

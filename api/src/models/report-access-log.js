import { Model } from './model.js'

export class ReportAccessLog extends Model {
  static table = 'report_access_log'
  static fillable = ['report_id', 'user_id', 'action', 'ip_address', 'user_agent']
  static ACTIONS = ['upload', 'view', 'download', 'delete', 'denied']

  record(reportId, userId, action, ip, userAgent) {
    return this.db.execute(
      `INSERT INTO report_access_log (report_id, user_id, action, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5)`,
      [reportId, userId, action, ip, userAgent],
    )
  }

  forReport(reportId, limit = 100) {
    return this.db.all(
      `SELECT l.id, l.action, l.created_at, l.ip_address, u.full_name AS user_name, u.role AS user_role
             FROM report_access_log l LEFT JOIN users u ON u.id = l.user_id
             WHERE l.report_id = $1 ORDER BY l.created_at DESC LIMIT $2`,
      [reportId, limit],
    )
  }
}

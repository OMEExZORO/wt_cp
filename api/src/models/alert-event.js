import { Model } from './model.js'

export class AlertEvent extends Model {
  static table = 'alert_events'
  static fillable = ['alert_id', 'event_type', 'from_status', 'to_status', 'actor_type', 'actor_user_id', 'channel', 'details']

  record(alertId, type, from, to, actorUserId, channel, details = {}) {
    return this.db.execute(
      `INSERT INTO alert_events (alert_id, event_type, from_status, to_status, actor_type, actor_user_id, channel, details)
             VALUES ($1, $2, $3, $4, $5, $6, $7, CAST($8 AS jsonb))`,
      [alertId, type, from, to, actorUserId === null ? 'system' : 'user', actorUserId, channel, JSON.stringify(details)],
    )
  }

  forAlert(alertId) {
    return this.db.all(
      `SELECT e.id, e.event_type, e.from_status, e.to_status, e.actor_type, e.channel, e.details, e.created_at,
                    u.full_name AS actor_name, u.role AS actor_role
             FROM alert_events e
             LEFT JOIN users u ON u.id = e.actor_user_id
             WHERE e.alert_id = $1
             ORDER BY e.created_at, e.id`,
      [alertId],
    )
  }
}

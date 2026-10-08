import { config } from '../config.js'
import { withTransaction } from '../db.js'
import { audit } from '../lib/audit.js'
import { email } from '../channels/index.js'
import { alertMessage } from './messages.js'
import { decideEscalation } from './escalationLogic.js'

const CANDIDATES_SQL = `
  SELECT a.id, a.status, a.escalation_level, a.notify_count, a.last_notified_at, a.next_escalation_at,
         a.acknowledged_at, a.created_at,
         p.full_name AS patient_name, COALESCE(p.email, pu.email) AS patient_email,
         r.full_name AS referrer_name, ru.email AS referrer_email
    FROM critical_alerts a
    JOIN patients p ON p.id = a.patient_id
    LEFT JOIN users pu ON pu.id = p.user_id
    LEFT JOIN referrers r ON r.id = a.referrer_id
    LEFT JOIN users ru ON ru.id = r.user_id
   WHERE a.status IN ('open', 'notified', 'escalated')
     AND a.acknowledged_at IS NULL
     AND a.escalation_level < 2
   ORDER BY a.created_at
   LIMIT 100
   FOR UPDATE OF a SKIP LOCKED`

const insertEvent = (client, alertId, type, fromStatus, toStatus, channel, details) =>
  client.query(
    `INSERT INTO alert_events (alert_id, event_type, from_status, to_status, actor_type, channel, details)
     VALUES ($1, $2, $3, $4, 'system', $5, $6::jsonb)`,
    [alertId, type, fromStatus, toStatus, channel, JSON.stringify(details)],
  )

const notify = async (client, alert) => {
  const portalUrl = `${config.frontendUrl}/portal`
  const targets = [
    { role: 'patient', to: alert.patient_email, name: alert.patient_name, label: 'you' },
    { role: 'referrer', to: alert.referrer_email, name: alert.referrer_name, label: 'your referred patient' },
  ]
  let sent = 0
  for (const target of targets) {
    if (!target.to) continue
    const message = alertMessage({ recipientName: target.name, audienceLabel: target.label, portalUrl, reminder: true })
    try {
      await email.send({ to: target.to, ...message })
      sent += 1
      await insertEvent(client, alert.id, 'resent', alert.status, alert.status, 'email', { recipient: target.role })
    } catch (error) {
      await insertEvent(client, alert.id, 'delivery_failed', alert.status, alert.status, 'email', {
        recipient: target.role,
        reason: String(error.message).slice(0, 200),
      })
    }
  }
  return sent
}

export const runEscalation = async (now = new Date()) => {
  const windowMs = config.escalationMinutes * 60 * 1000
  const summary = { checked: 0, resent: 0, flagged: 0 }

  await withTransaction(async (client) => {
    const { rows } = await client.query(CANDIDATES_SQL)
    summary.checked = rows.length
    for (const alert of rows) {
      const action = decideEscalation(alert, now, windowMs)
      if (action === 'resend') {
        const sent = await notify(client, alert)
        await insertEvent(client, alert.id, 'escalated', alert.status, 'escalated', null, {
          stage: 1,
          window_minutes: config.escalationMinutes,
          emails_sent: sent,
        })
        await client.query(
          `UPDATE critical_alerts
              SET status = 'escalated', escalation_level = 1, notify_count = notify_count + $2,
                  last_notified_at = now(), next_escalation_at = now() + make_interval(mins => $3)
            WHERE id = $1`,
          [alert.id, sent, config.escalationMinutes],
        )
        await client.query(
          `INSERT INTO audit_log (actor_role, action, entity_type, entity_id, metadata)
           VALUES ('system', 'alert.escalated_resend', 'critical_alert', $1, $2::jsonb)`,
          [alert.id, JSON.stringify({ emails_sent: sent })],
        )
        audit.info('alert.escalated_resend', { alert_id: alert.id, emails_sent: sent })
        summary.resent += 1
      } else if (action === 'flag_staff') {
        await insertEvent(client, alert.id, 'staff_flagged', alert.status, 'escalated', 'phone', {
          stage: 2,
          instruction: 'Reception to phone the patient',
        })
        await client.query(
          `UPDATE critical_alerts
              SET status = 'escalated', escalation_level = 2, staff_flagged_at = now(), next_escalation_at = NULL
            WHERE id = $1`,
          [alert.id],
        )
        await client.query(
          `INSERT INTO audit_log (actor_role, action, entity_type, entity_id, metadata)
           VALUES ('system', 'alert.staff_flagged', 'critical_alert', $1, '{}'::jsonb)`,
          [alert.id],
        )
        audit.warn('alert.staff_flagged', { alert_id: alert.id })
        summary.flagged += 1
      }
    }
  })

  return summary
}

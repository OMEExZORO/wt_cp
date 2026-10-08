import { config } from '../config.js'
import { withTransaction } from '../db.js'
import { audit } from '../lib/audit.js'
import { email } from '../channels/index.js'
import { reminderMessage } from './messages.js'
import { selectDueReminders } from './reminderLogic.js'

const CANDIDATES_SQL = `
  SELECT ap.id, ap.reference_code, ap.status, ap.reminder_sent_at, ap.scan_type_id,
         ((s.slot_date + s.start_time) AT TIME ZONE 'Asia/Kolkata') AS starts_at,
         to_char(s.slot_date, 'DD Mon YYYY') || ' at ' || to_char(s.start_time, 'HH24:MI') AS when_label,
         st.name AS scan_name, st.modality, st.preparation_tips,
         b.name AS branch_name, b.address_line AS branch_address,
         p.full_name AS patient_name, COALESCE(p.email, u.email) AS patient_email
    FROM appointments ap
    JOIN slots s ON s.id = ap.slot_id
    JOIN scan_types st ON st.id = ap.scan_type_id
    JOIN branches b ON b.id = ap.branch_id
    JOIN patients p ON p.id = ap.patient_id
    LEFT JOIN users u ON u.id = p.user_id
   WHERE ap.status = 'confirmed'
     AND ap.reminder_sent_at IS NULL
     AND ((s.slot_date + s.start_time) AT TIME ZONE 'Asia/Kolkata') > now()
     AND ((s.slot_date + s.start_time) AT TIME ZONE 'Asia/Kolkata') <= now() + make_interval(hours => $1)
   ORDER BY s.slot_date, s.start_time
   LIMIT 200
   FOR UPDATE OF ap SKIP LOCKED`

const CHECKLIST_SQL = `
  SELECT question, help_text
    FROM checklist_items
   WHERE is_active AND (scan_type_id = $1 OR modality = $2)
   ORDER BY sort_order
   LIMIT 12`

export const runReminders = async (now = new Date()) => {
  const leadMs = config.reminderLeadHours * 3600 * 1000
  const summary = { checked: 0, sent: 0, skipped: 0 }

  await withTransaction(async (client) => {
    const { rows } = await client.query(CANDIDATES_SQL, [config.reminderLeadHours])
    summary.checked = rows.length
    for (const appointment of selectDueReminders(rows, now, leadMs)) {
      if (!appointment.patient_email) {
        summary.skipped += 1
        continue
      }
      const { rows: checklist } = await client.query(CHECKLIST_SQL, [appointment.scan_type_id, appointment.modality])
      const message = reminderMessage({
        patientName: appointment.patient_name,
        appointment,
        prepTips: appointment.preparation_tips,
        checklist,
      })
      try {
        await email.send({ to: appointment.patient_email, ...message })
      } catch (error) {
        audit.error('reminder.failed', { appointment_id: appointment.id, reason: String(error.message).slice(0, 200) })
        summary.skipped += 1
        continue
      }
      await client.query('UPDATE appointments SET reminder_sent_at = now() WHERE id = $1', [appointment.id])
      await client.query(
        `INSERT INTO audit_log (actor_role, action, entity_type, entity_id, metadata)
         VALUES ('system', 'reminder.sent', 'appointment', $1, $2::jsonb)`,
        [appointment.id, JSON.stringify({ reference_code: appointment.reference_code })],
      )
      audit.info('reminder.sent', { appointment_id: appointment.id, reference_code: appointment.reference_code })
      summary.sent += 1
    }
  })

  return summary
}

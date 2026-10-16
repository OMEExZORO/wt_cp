import { toIso } from '../../core/time.js'
import { ok } from '../../core/response.js'
import { flag } from '../../models/flag.js'
import { level, sortQueue } from './reading-queue.js'

export const show = async (req, app) => {
  const now = app.services.clock.now()
  const timezone = app.config.timezone
  const rows = sortQueue(await app.models.readingQueue.awaitingReport(500), now)
  const queue = rows.map((row) => ({
    appointment_id: row.id,
    reference_code: row.reference_code,
    patient_name: row.patient_name,
    scan_name: row.scan_name,
    modality: row.modality,
    branch_name: row.branch_name,
    urgency: row.urgency,
    is_referred: row.referral_id !== null,
    waiting_since: toIso(row.waiting_since, timezone),
    waiting_minutes: row.waiting_minutes,
    wait_level: level(String(row.urgency), row.waiting_minutes),
  }))
  const reports = (await app.models.readingQueue.recentReports(30, 50)).map((row) => ({
    report_id: row.id,
    title: row.title,
    status: row.status,
    is_critical: flag(row.is_critical),
    reference_code: row.reference_code,
    patient_name: row.patient_name,
    scan_name: row.scan_name,
    alert_id: row.alert_id,
    alert_status: row.alert_status,
    created_at: toIso(row.created_at, timezone),
  }))
  return ok({ queue, recent_reports: reports, generated_at: app.services.clock.atom(now) })
}

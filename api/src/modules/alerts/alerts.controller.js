import { NotFoundError } from '../../core/errors.js'
import { requireUser } from '../../core/http.js'
import { created, ok } from '../../core/response.js'
import { toIso } from '../../core/time.js'
import * as presenter from '../../services/alerts/alert-presenter.js'
import { mayAcknowledge } from '../../services/alerts/alert-workflow.js'

export const flag = async (req, app) => {
  const user = requireUser(req)
  const data = await app.validate(req, { note: 'nullable|text|max:1000' })
  const alert = await app.services.alerts.raise(user, String(req.param('id')), data.note ?? null)
  await app.audit.log('alert.raised', req, {
    entity_type: 'critical_alert',
    entity_id: alert.id,
    metadata: { report_id: alert.report_id },
  })
  return created({
    alert: presenter.staff(alert, app.config.timezone),
    note_stored: (data.note ?? null) !== null && app.services.alerts.noteStorageAvailable(),
  })
}

export const mine = async (req, app) => {
  const user = requireUser(req)
  const rows = await app.models.criticalAlerts.listUnacknowledgedForUser(String(user.id), String(user.role))
  const audience = user.role === 'referrer' ? 'referrer' : 'patient'
  return ok({ alerts: rows.map((row) => presenter.banner(row, audience, app.config.timezone)) })
}

export const index = async (req, app) => {
  const filters = await app.validate(req, {
    status: 'nullable|in:active,all,open,notified,escalated,acknowledged,resolved,cancelled',
    flagged: 'nullable|boolean',
    q: 'nullable|string|max:80',
    page: 'nullable|integer|min:1',
  })
  const page = Number(filters.page ?? 1)
  const perPage = 25
  const rows = await app.models.criticalAlerts.listForStaff(filters, perPage, (page - 1) * perPage)
  return ok({ alerts: rows.map((row) => presenter.staff(row, app.config.timezone)) }, 200, {
    page,
    per_page: perPage,
    total: await app.models.criticalAlerts.countForStaff(filters),
  })
}

export const events = async (req, app) => {
  const alert = await app.models.criticalAlerts.findDetailed(String(req.param('id')))
  if (alert === null) throw new NotFoundError('Alert not found.')
  const rows = await app.models.alertEvents.forAlert(String(alert.id))
  return ok({
    alert: presenter.staff(alert, app.config.timezone),
    events: rows.map((row) => presenter.event(row, app.config.timezone)),
  })
}

export const acknowledge = async (req, app) => {
  const user = requireUser(req)
  const alert = await app.models.criticalAlerts.findDetailed(String(req.param('id')))
  if (alert === null || !mayAcknowledge(user, alert)) throw new NotFoundError('Alert not found.')
  const updated = await app.services.alerts.acknowledge(user, alert)
  await app.audit.log('alert.acknowledged', req, { entity_type: 'critical_alert', entity_id: updated.id })
  return ok({
    alert_id: updated.id,
    status: updated.status,
    acknowledged_at: toIso(updated.acknowledged_at, app.config.timezone),
  })
}

export const resolve = async (req, app) => {
  const user = requireUser(req)
  const data = await app.validate(req, { note: 'required|text|min:3|max:500' })
  const alertId = String(req.param('id'))
  if ((await app.models.criticalAlerts.findDetailed(alertId)) === null) throw new NotFoundError('Alert not found.')
  const updated = await app.services.alerts.resolve(user, alertId, data.note)
  await app.audit.log('alert.resolved', req, { entity_type: 'critical_alert', entity_id: alertId })
  return ok({ alert: presenter.staff(updated, app.config.timezone) })
}

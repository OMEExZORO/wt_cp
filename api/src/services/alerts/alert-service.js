import { ConflictError, NotFoundError } from '../../core/errors.js'
import { assertTransition } from './alert-workflow.js'

export class AlertService {
  constructor({ db, alerts, events, mail, sms, notes, config, logger, windowMinutes }) {
    this.db = db
    this.alerts = alerts
    this.events = events
    this.mail = mail
    this.sms = sms
    this.notes = notes
    this.config = config
    this.logger = logger
    this.windowMinutes = windowMinutes
  }

  noteStorageAvailable() {
    return this.notes.available()
  }

  async raise(user, reportId, note) {
    const context = await this.alerts.reportContext(reportId)
    if (context === null || context.deleted_at !== null) throw new NotFoundError('Report not found.')
    const stored = note !== null && note !== undefined && note !== '' && this.notes.available() ? this.notes.protect(note) : null

    const alertId = await this.db.tx(async (tx) => {
      const alerts = this.alerts.using(tx)
      const events = this.events.using(tx)
      if ((await alerts.lockReport(reportId)) === null) throw new NotFoundError('Report not found.')
      if (await alerts.hasActiveForReport(reportId)) throw new ConflictError('This report already has an active critical alert.')
      const alert = await alerts.create({
        report_id: reportId,
        patient_id: context.patient_id,
        referrer_id: context.referrer_id,
        raised_by_user_id: user.id,
        finding_summary_encrypted: stored,
        status: 'open',
      })
      await alerts.markReportCritical(reportId)
      await events.record(alert.id, 'raised', null, 'open', String(user.id), null, {
        report_id: reportId,
        has_clinical_note: stored !== null,
      })
      return String(alert.id)
    })

    const sent = await this.notify(alertId, context)
    await this.db.tx(async (tx) => {
      await this.alerts.using(tx).applyNotified(alertId, sent, this.windowMinutes)
      await this.events.using(tx).record(alertId, 'notified', 'open', 'notified', null, 'in_app', { surface: 'portal_banner' })
    })

    return (await this.alerts.findDetailed(alertId)) ?? {}
  }

  async acknowledge(user, alert) {
    const alertId = String(alert.id)
    await this.db.tx(async (tx) => {
      const alerts = this.alerts.using(tx)
      const locked = await alerts.lockForUpdate(alertId)
      if (locked === null) throw new NotFoundError('Alert not found.')
      assertTransition(String(locked.status), 'acknowledged')
      await alerts.applyAcknowledged(alertId, String(user.id))
      await this.events.using(tx).record(alertId, 'acknowledged', String(locked.status), 'acknowledged', String(user.id), 'in_app', {
        by_role: user.role,
      })
    })
    return (await this.alerts.findDetailed(alertId)) ?? {}
  }

  async resolve(user, alertId, note) {
    await this.db.tx(async (tx) => {
      const alerts = this.alerts.using(tx)
      const events = this.events.using(tx)
      const locked = await alerts.lockForUpdate(alertId)
      if (locked === null) throw new NotFoundError('Alert not found.')
      assertTransition(String(locked.status), 'resolved')
      await events.record(alertId, 'phone_contacted', String(locked.status), String(locked.status), String(user.id), 'phone', { note })
      await alerts.applyResolved(alertId, String(user.id), note)
      await events.record(alertId, 'resolved', String(locked.status), 'resolved', String(user.id), null, {})
    })
    return (await this.alerts.findDetailed(alertId)) ?? {}
  }

  async notify(alertId, context) {
    const portal = `${String(this.config.frontendUrl).replace(/\/+$/, '')}/portal`
    const targets = [
      {
        recipient: 'patient',
        to: String(context.patient_email ?? ''),
        name: String(context.patient_name),
        intro: `A finding in your ${context.scan_name} report needs urgent attention.`,
      },
      {
        recipient: 'referrer',
        to: String(context.referrer_email ?? ''),
        name: String(context.referrer_name ?? ''),
        intro: `A finding in the ${context.scan_name} report of your referred patient needs urgent attention.`,
      },
    ]
    let sent = 0
    for (const target of targets) {
      if (target.to === '') continue
      const ok = await this.mail.sendTemplate(target.to, target.name, 'critical-alert', {
        name: target.name,
        intro: target.intro,
        scan_name: String(context.scan_name),
        reference: String(context.reference_code),
        link: portal,
      })
      if (ok) {
        sent += 1
        await this.events.record(alertId, 'notified', 'open', 'open', null, 'email', { recipient: target.recipient })
      } else {
        await this.events.record(alertId, 'delivery_failed', 'open', 'open', null, 'email', { recipient: target.recipient })
      }
    }
    const phone = String(context.patient_phone ?? '').trim()
    if (phone !== '') {
      const delivered = await this.sms.send(
        phone,
        'Meghnad Diagnostic Centre: an important finding in your report needs attention. Please sign in to your portal.',
      )
      await this.events.record(alertId, delivered ? 'notified' : 'delivery_failed', 'open', 'open', null, 'sms_stub', { recipient: 'patient' })
    }
    return sent
  }
}

export class StubSmsGateway {
  constructor(logger) {
    this.logger = logger
  }

  async send(phone, message) {
    this.logger.info('sms.stub', { to_last4: phone.slice(-4), length: Buffer.byteLength(message) })
    return true
  }
}

export class EncryptedNoteProtector {
  constructor(encryption) {
    this.encryption = encryption
  }

  available() {
    return true
  }

  protect(plain) {
    return this.encryption.encryptText(plain)
  }
}

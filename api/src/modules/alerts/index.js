import { envInt } from '../../core/env.js'
import { get, group, patch, post } from '../../core/router.js'
import { AlertEvent } from '../../models/alert-event.js'
import { CriticalAlert } from '../../models/critical-alert.js'
import { AlertService, EncryptedNoteProtector, StubSmsGateway } from '../../services/alerts/alert-service.js'
import { encryptionOf } from '../../services/reports/context.js'
import * as controller from './alerts.controller.js'

export const routes = [
  post('/reports/{id:uuid}/critical', controller.flag, ['auth', 'role:doctor,admin', 'throttle:alert-flag,20,10']),
  group('/alerts', ['auth'], [
    get('/mine', controller.mine, ['role:patient,referrer']),
    get('', controller.index, ['role:receptionist,doctor,admin']),
    get('/{id:uuid}/events', controller.events, ['role:receptionist,doctor,admin']),
    post('/{id:uuid}/acknowledge', controller.acknowledge, ['role:patient,referrer', 'throttle:alert-ack,30,10']),
    patch('/{id:uuid}/resolve', controller.resolve, ['role:receptionist,admin']),
  ]),
]

export const register = (app) => {
  const options = { timezone: app.config.timezone }
  app.models.criticalAlerts ??= new CriticalAlert(app.db, options)
  app.models.alertEvents ??= new AlertEvent(app.db, options)

  const notes = {
    available: () => {
      try {
        encryptionOf(app)
        return true
      } catch {
        return false
      }
    },
    protect: (plain) => new EncryptedNoteProtector(encryptionOf(app)).protect(plain),
  }

  app.services.alerts = new AlertService({
    db: app.db,
    alerts: app.models.criticalAlerts,
    events: app.models.alertEvents,
    mail: app.mail,
    sms: new StubSmsGateway(app.logger),
    notes,
    config: app.config,
    logger: app.logger,
    windowMinutes: envInt('ALERT_ESCALATION_MINUTES', 30),
  })
}

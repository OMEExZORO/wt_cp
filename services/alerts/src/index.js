import { config } from './config.js'
import { createApp } from './app.js'
import { audit } from './lib/audit.js'
import { startScheduler } from './jobs/scheduler.js'

const app = createApp()

const server = app.listen(config.port, () => {
  process.stdout.write(`diagnocare-alerts listening on port ${config.port}\n`)
  audit.info('service.started', { port: config.port, mail_driver: config.mail.driver, escalation_minutes: config.escalationMinutes })
})

const stopScheduler = config.jobsEnabled ? startScheduler(config.jobIntervalSeconds) : () => {}

const shutdown = () => {
  stopScheduler()
  audit.info('service.stopped')
  server.close(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

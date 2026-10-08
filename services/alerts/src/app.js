import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import helmet from 'helmet'
import { config } from './config.js'
import { pool } from './db.js'
import { audit } from './lib/audit.js'
import { requireServiceToken } from './http/auth.js'
import { jobStatus, runJob } from './jobs/scheduler.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const ok = (res, data, status = 200) => res.status(status).json({ data, error: null })
const fail = (res, status, code, message) => res.status(status).json({ data: null, error: { code, message } })

export const createApp = () => {
  const app = express()
  app.disable('x-powered-by')
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], imgSrc: ["'self'", 'data:'], objectSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
      strictTransportSecurity: config.env === 'production',
    }),
  )
  app.use(express.json({ limit: '100kb' }))
  app.use(express.static(path.resolve(here, '../public')))

  app.get('/health', (_req, res) => ok(res, { status: 'ok', service: 'diagnocare-alerts' }))

  app.get('/api/status', async (_req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT count(*) FILTER (WHERE status IN ('open', 'notified', 'escalated') AND acknowledged_at IS NULL)::int AS open,
                count(*) FILTER (WHERE status = 'escalated' AND acknowledged_at IS NULL AND escalation_level = 1)::int AS escalated,
                count(*) FILTER (WHERE status = 'escalated' AND acknowledged_at IS NULL AND escalation_level >= 2)::int AS staff_flagged
           FROM critical_alerts`,
      )
      ok(res, { service: 'diagnocare-alerts', time: new Date().toISOString(), jobs: jobStatus(), alerts: rows[0] })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/alerts/open', requireServiceToken, async (_req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, status, escalation_level, notify_count, last_notified_at, next_escalation_at, staff_flagged_at, created_at
           FROM critical_alerts
          WHERE status IN ('open', 'notified', 'escalated') AND acknowledged_at IS NULL
          ORDER BY created_at
          LIMIT 200`,
      )
      ok(res, rows)
    } catch (error) {
      next(error)
    }
  })

  const trigger = (name) => async (_req, res, next) => {
    try {
      const result = await runJob(name)
      if (result.skipped) return fail(res, 409, 'CONFLICT', 'Job is already running.')
      ok(res, result)
    } catch (error) {
      next(error)
    }
  }
  app.post('/api/jobs/escalate/run', requireServiceToken, trigger('escalation'))
  app.post('/api/jobs/reminders/run', requireServiceToken, trigger('reminders'))

  app.get('/api/logs/tail', requireServiceToken, (req, res) => {
    const requested = Number.parseInt(req.query.lines ?? '100', 10)
    if (!Number.isInteger(requested) || requested < 1 || requested > 1000) {
      return fail(res, 422, 'VALIDATION_FAILED', 'lines must be an integer between 1 and 1000.')
    }
    ok(res, { lines: audit.tail(requested) })
  })

  app.use((_req, res) => fail(res, 404, 'NOT_FOUND', 'Resource not found'))

  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') return fail(res, 400, 'BAD_REQUEST', 'Malformed JSON body.')
    audit.error('http.error', { reason: String(error.message).slice(0, 200) })
    fail(res, 500, 'SERVER_ERROR', 'Something went wrong.')
  })

  return app
}

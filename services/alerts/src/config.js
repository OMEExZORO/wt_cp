import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const here = path.dirname(fileURLToPath(import.meta.url))
const serviceRoot = path.resolve(here, '..')
dotenv.config({ path: path.resolve(serviceRoot, '.env'), quiet: true })
dotenv.config({ path: path.resolve(serviceRoot, '../../.env'), quiet: true })

const int = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const databaseUrl = () => {
  const raw = process.env.DATABASE_URL
  if (!raw) return null
  const url = new URL(raw)
  url.searchParams.delete('sslmode')
  return url.toString()
}

const sslDisabled = () => {
  if (process.env.DB_SSLMODE === 'disable') return true
  const raw = process.env.DATABASE_URL
  return raw ? new URL(raw).searchParams.get('sslmode') === 'disable' : false
}

export const config = {
  env: process.env.APP_ENV ?? 'development',
  port: int(process.env.ALERTS_SERVICE_PORT, 4000),
  escalationMinutes: int(process.env.ALERT_ESCALATION_MINUTES, 30),
  reminderLeadHours: int(process.env.REMINDER_LEAD_HOURS, 24),
  jobIntervalSeconds: int(process.env.JOB_INTERVAL_SECONDS, 60),
  jobsEnabled: process.env.ALERTS_JOBS_ENABLED !== 'false',
  serviceToken: process.env.ALERTS_SERVICE_TOKEN ?? '',
  frontendUrl: (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/+$/, ''),
  database: {
    connectionString: databaseUrl(),
    host: process.env.DB_HOST,
    port: int(process.env.DB_PORT, 5432),
    database: process.env.DB_NAME ?? 'postgres',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: sslDisabled() ? false : { rejectUnauthorized: false },
  },
  mail: {
    driver: process.env.MAIL_DRIVER === 'smtp' ? 'smtp' : 'log',
    from: process.env.MAIL_FROM ?? 'no-reply@example.com',
    fromName: process.env.MAIL_FROM_NAME ?? 'Meghnad Diagnostic Centre',
    smtp: {
      host: process.env.SMTP_HOST,
      port: int(process.env.SMTP_PORT, 587),
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      secure: (process.env.SMTP_ENCRYPTION ?? 'tls') === 'ssl',
    },
  },
  logs: {
    dir: path.resolve(serviceRoot, process.env.ALERTS_LOG_DIR ?? 'logs'),
    maxBytes: int(process.env.ALERTS_LOG_MAX_BYTES, 1024 * 1024),
    keep: int(process.env.ALERTS_LOG_KEEP, 7),
  },
}

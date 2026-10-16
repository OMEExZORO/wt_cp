import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { envBool, envInt, envString } from './env.js'

export const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const repoRoot = path.resolve(apiRoot, '..')

const databaseUrl = (env) => {
  const raw = envString('DATABASE_URL', null, env)
  if (!raw) return null
  const url = new URL(raw)
  url.searchParams.delete('sslmode')
  return url.toString()
}

const sslDisabled = (env) => {
  if (envString('DB_SSLMODE', null, env) === 'disable') return true
  const raw = envString('DATABASE_URL', null, env)
  return raw ? new URL(raw).searchParams.get('sslmode') === 'disable' : false
}

export const buildConfig = (env = process.env) => {
  const appEnv = envString('APP_ENV', 'production', env)
  const isProduction = appEnv === 'production'
  const frontendUrl = envString('FRONTEND_URL', 'http://localhost:5173', env).replace(/\/+$/, '')
  const sameSiteRaw = envString('SESSION_SAMESITE', isProduction ? 'None' : 'Lax', env).toLowerCase()
  const sameSiteName = sameSiteRaw.charAt(0).toUpperCase() + sameSiteRaw.slice(1)
  const secure = envBool('SESSION_SECURE', isProduction, env) || sameSiteName === 'None'
  const origins = envString('CORS_ALLOWED_ORIGINS', frontendUrl, env)
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean)

  return {
    env: appEnv,
    isProduction,
    debug: !isProduction && envBool('APP_DEBUG', true, env),
    url: envString('APP_URL', 'http://localhost:8000', env),
    port: envInt('PORT', 8000, env),
    frontendUrl,
    apiPrefix: '/api/v1',
    timezone: envString('APP_TIMEZONE', 'Asia/Kolkata', env),
    storageBucket: envString('STORAGE_BUCKET', 'reports', env),
    trustProxy: envBool('TRUST_PROXY', false, env),
    csrfSecret: envString('CSRF_SECRET', '', env),
    maxBodyBytes: envInt('MAX_BODY_BYTES', 12 * 1024 * 1024, env),
    database: {
      connectionString: databaseUrl(env),
      host: envString('DB_HOST', undefined, env),
      port: envInt('DB_PORT', 5432, env),
      database: envString('DB_NAME', 'postgres', env),
      user: envString('DB_USER', undefined, env),
      password: envString('DB_PASSWORD', undefined, env),
      ssl: sslDisabled(env) ? false : { rejectUnauthorized: false },
      poolMax: envInt('DB_POOL_MAX', 10, env),
    },
    cors: {
      allowedOrigins: [...new Set(origins)],
      maxAge: 600,
    },
    session: {
      name: 'dc_session',
      store: envString('SESSION_STORE', 'database', env),
      idleMinutes: envInt('SESSION_IDLE_MINUTES', 30, env),
      absoluteHours: envInt('SESSION_ABSOLUTE_HOURS', 12, env),
      secure,
      sameSite: ['Lax', 'Strict', 'None'].includes(sameSiteName) ? sameSiteName : 'Lax',
      domain: envString('SESSION_DOMAIN', '', env),
    },
    remember: {
      cookie: 'dc_remember',
      days: envInt('REMEMBER_DAYS', 30, env),
      graceSeconds: 60,
    },
    auth: {
      maxFailedAttempts: envInt('LOGIN_MAX_ATTEMPTS', 5, env),
      lockoutMinutes: envInt('LOGIN_LOCKOUT_MINUTES', 15, env),
      ipMaxFailedAttempts: envInt('LOGIN_IP_MAX_ATTEMPTS', 30, env),
      ipWindowMinutes: 15,
      requireVerifiedEmailForLogin: false,
      resetTokenMinutes: 60,
      verifyTokenHours: 48,
      consentVersion: '2026-10-v1',
    },
    mail: {
      driver: envString('MAIL_DRIVER', 'log', env),
      from: envString('MAIL_FROM', 'no-reply@example.com', env),
      fromName: envString('MAIL_FROM_NAME', 'Meghnad Diagnostic Centre', env),
      smtpHost: envString('SMTP_HOST', '', env),
      smtpPort: envInt('SMTP_PORT', 587, env),
      smtpUser: envString('SMTP_USER', '', env),
      smtpPass: envString('SMTP_PASS', '', env),
      smtpEncryption: envString('SMTP_ENCRYPTION', 'tls', env),
      logPath: path.join(apiRoot, 'storage', 'logs', 'mail.log'),
    },
    logPath: envString('LOG_PATH', '', env),
    storagePath: path.join(apiRoot, 'storage'),
  }
}

import assert from 'node:assert/strict'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'
import { createKernel } from '../src/app.js'
import { apiRoot, buildConfig, repoRoot } from '../src/core/config.js'
import { loadEnvFiles } from '../src/core/env.js'
import { PgDb } from '../src/core/database.js'
import { Logger } from '../src/core/logger.js'
import { Client } from './support/harness.js'

loadEnvFiles(path.join(apiRoot, '.env'), path.join(repoRoot, 'backend', '.env'), path.join(repoRoot, '.env'))

const live = Boolean(process.env.DATABASE_URL || process.env.DB_HOST) && process.env.LIVE_DB_TESTS === '1'

describe('live database (read-only)', { skip: live ? false : 'set LIVE_DB_TESTS=1 with DATABASE_URL or DB_* to run' }, () => {
  let app
  let db

  before(() => {
    const config = buildConfig({ ...process.env, SESSION_STORE: 'memory', CSRF_SECRET: process.env.CSRF_SECRET || 'live-test-secret' })
    db = PgDb.create(config)
    app = createKernel({ config, db, logger: new Logger({ silent: true }) })
  })

  after(async () => {
    await db?.close()
  })

  it('connects and sees the tables the auth module relies on', async () => {
    const rows = await db.all(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)",
      [['users', 'patients', 'referrers', 'login_attempts', 'rate_limits', 'remember_tokens', 'password_resets', 'email_verifications', 'audit_log']],
    )
    assert.equal(rows.length, 9)
  })

  it('serves health and a CSRF token', async () => {
    const client = new Client(app)
    assert.equal((await client.get('/health')).status, 200)
    const csrf = await client.get('/auth/csrf')
    assert.match(csrf.body.data.csrf_token, /^[a-f0-9]{64}$/)
  })

  it('formats user timestamps like PHP ATOM strings', async () => {
    const row = await db.one('SELECT created_at FROM users ORDER BY created_at LIMIT 1')
    if (row === null) return
    const iso = app.models.users.toPublic({ id: 'x', email: 'x', role: 'patient', full_name: 'x', created_at: row.created_at }).created_at
    assert.match(iso, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/)
  })
})

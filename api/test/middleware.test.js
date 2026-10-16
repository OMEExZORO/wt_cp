import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { AuthenticationError, AuthorizationError, RateLimitError } from '../src/core/errors.js'
import { ApiRequest } from '../src/core/request.js'
import { ApiResponse } from '../src/core/response.js'
import { cors } from '../src/middleware/cors.js'
import { rateLimit } from '../src/middleware/rate-limit.js'
import { requireAuth } from '../src/middleware/require-auth.js'
import { role } from '../src/middleware/role.js'
import { securityHeaders } from '../src/middleware/security-headers.js'
import { verifiedEmail } from '../src/middleware/verified-email.js'
import { ROLES } from '../src/models/user.js'
import { InMemoryAuditLogger } from '../src/services/audit-logger.js'
import { RateLimiter } from '../src/services/rate-limiter.js'
import { Client, makeApp } from './support/harness.js'

const next = async () => ApiResponse.json({ ok: true })

const requestAs = (userRole, verified = true) => {
  const req = new ApiRequest({ path: '/api/v1/dashboards/admin' })
  req.user = userRole === null ? null : { id: 'u-1', role: userRole, email_verified_at: verified ? '2026-01-01' : null }
  return req
}

describe('role middleware', () => {
  for (const userRole of ROLES) {
    for (const required of ROLES) {
      it(`${userRole} on ${required}`, async () => {
        const audit = new InMemoryAuditLogger()
        const run = role({ audit })(requestAs(userRole), next, required)
        if (userRole === required) {
          assert.equal((await run).status, 200)
        } else {
          await assert.rejects(run, AuthorizationError)
          assert.deepEqual(audit.actions(), ['security.forbidden'])
        }
      })
    }
  }

  it('accepts any of several roles and rejects guests with 401', async () => {
    const audit = new InMemoryAuditLogger()
    assert.equal((await role({ audit })(requestAs('admin'), next, 'doctor', 'admin')).status, 200)
    await assert.rejects(role({ audit })(requestAs(null), next, 'admin'), AuthenticationError)
  })

  it('rejects misconfiguration', async () => {
    const audit = new InMemoryAuditLogger()
    await assert.rejects(role({ audit })(requestAs('admin'), next), /at least one role/)
    await assert.rejects(role({ audit })(requestAs('admin'), next, 'wizard'), /Unknown role/)
  })
})

describe('auth and verified middleware', () => {
  it('requires a user and explains expired sessions', async () => {
    const guest = requestAs(null)
    await assert.rejects(requireAuth()(guest, next), { message: 'Please sign in to continue.' })
    guest.sessionExpired = true
    await assert.rejects(requireAuth()(guest, next), { message: 'Your session expired due to inactivity. Please sign in again.' })
    assert.equal((await requireAuth()(requestAs('patient'), next)).status, 200)
  })

  it('requires a verified email', async () => {
    await assert.rejects(verifiedEmail()(requestAs('patient', false), next), {
      message: 'Please verify your email address to use this feature.',
    })
    assert.equal((await verifiedEmail()(requestAs('patient'), next)).status, 200)
  })
})

describe('rate limit middleware', () => {
  const limiterWith = (hits) =>
    new RateLimiter({ limits: { hit: async () => ({ hits, retry_after: 42 }), clear: async () => 0 } })

  it('passes under the limit and throws 429 with Retry-After seconds over it', async () => {
    const audit = new InMemoryAuditLogger()
    const req = requestAs('patient')
    assert.equal((await rateLimit({ audit, limiter: limiterWith(3) })(req, next, 'booking', '3', '10')).status, 200)
    await assert.rejects(rateLimit({ audit, limiter: limiterWith(4) })(req, next, 'booking', '3', '10'), (error) => {
      assert.ok(error instanceof RateLimitError)
      assert.equal(error.retryAfter, 42)
      return true
    })
    assert.deepEqual(audit.actions(), ['security.rate_limited'])
  })
})

describe('security headers and CORS', () => {
  it('adds the hardening headers and no-store caching', async () => {
    const { config } = makeApp()
    const response = await securityHeaders({ config })(new ApiRequest(), next)
    assert.equal(response.header('X-Content-Type-Options'), 'nosniff')
    assert.equal(response.header('X-Frame-Options'), 'DENY')
    assert.equal(response.header('Cache-Control'), 'no-store')
    assert.match(response.header('Content-Security-Policy'), /default-src 'none'/)
    assert.equal(response.header('Strict-Transport-Security'), null)
  })

  it('adds HSTS in production', async () => {
    const { config } = makeApp({ env: { APP_ENV: 'production' } })
    const response = await securityHeaders({ config })(new ApiRequest(), next)
    assert.equal(response.header('Strict-Transport-Security'), 'max-age=31536000; includeSubDomains')
  })

  it('answers allowed preflights and omits CORS headers for strangers', async () => {
    const { config } = makeApp()
    const preflight = (origin) =>
      cors({ config })(
        new ApiRequest({ method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST' } }),
        next,
      )
    const allowed = await preflight('http://localhost:5173')
    assert.equal(allowed.status, 204)
    assert.equal(allowed.header('Access-Control-Allow-Origin'), 'http://localhost:5173')
    assert.equal(allowed.header('Access-Control-Allow-Credentials'), 'true')
    assert.equal(allowed.header('Access-Control-Allow-Headers'), 'Accept, Content-Type, X-CSRF-Token, X-Requested-With')
    assert.equal(allowed.header('Access-Control-Max-Age'), '600')
    const stranger = await preflight('https://evil.example')
    assert.equal(stranger.status, 204)
    assert.equal(stranger.header('Access-Control-Allow-Origin'), null)
    assert.equal(stranger.header('Vary'), 'Origin')
  })

  it('blocks unsafe requests from foreign origins before they reach the app', async () => {
    const { app } = makeApp()
    const client = new Client(app, { origin: 'https://evil.example' })
    const blocked = await client.request('POST', '/auth/login', { json: {} })
    assert.equal(blocked.status, 403)
    assert.equal(blocked.body.error.code, 'FORBIDDEN')
    assert.equal(blocked.response.header('X-Frame-Options'), null)
    const safe = await client.get('/health')
    assert.equal(safe.status, 200)
    assert.equal(safe.response.header('Access-Control-Allow-Origin'), null)
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ApiRequest } from '../src/core/request.js'
import { Client, makeApp } from './support/harness.js'

describe('health and envelope', () => {
  it('returns the JSON envelope with security headers and no session cookie', async () => {
    const { app } = makeApp()
    const { status, body, response } = await new Client(app).get('/health')
    assert.equal(status, 200)
    assert.deepEqual(body, { data: { status: 'ok', service: 'diagnocare-api' }, error: null })
    assert.equal(response.header('Content-Type'), 'application/json; charset=utf-8')
    assert.equal(response.header('X-Frame-Options'), 'DENY')
    assert.deepEqual(response.cookies, [])
  })

  it('renders 404 and 405 with the error envelope', async () => {
    const { app } = makeApp()
    const client = new Client(app)
    const missing = await client.get('/nope')
    assert.equal(missing.status, 404)
    assert.deepEqual(missing.body, { data: null, error: { code: 'NOT_FOUND', message: 'The requested endpoint does not exist.' } })
    const wrongMethod = await client.request('DELETE', '/health')
    assert.equal(wrongMethod.status, 405)
    assert.equal(wrongMethod.response.header('Allow'), 'GET')
    assert.equal(wrongMethod.body.error.code, 'METHOD_NOT_ALLOWED')
  })
})

describe('CSRF and session cookies', () => {
  it('issues a token and sets the dc_session cookie with PHP-compatible flags', async () => {
    const { app } = makeApp()
    const client = new Client(app)
    const { body, response } = await client.get('/auth/csrf')
    assert.match(body.data.csrf_token, /^[a-f0-9]{64}$/)
    assert.equal(body.data.header, 'X-CSRF-Token')
    assert.equal(response.cookies.length, 1)
    assert.match(response.cookies[0], /^dc_session=[a-f0-9]{48}; path=\/; HttpOnly; SameSite=Lax$/)
  })

  it('marks cookies secure when SameSite is None', async () => {
    const { app } = makeApp({ env: { SESSION_SAMESITE: 'None' } })
    const { response } = await new Client(app).get('/auth/csrf')
    assert.match(response.cookies[0], /; secure; HttpOnly; SameSite=None$/)
  })

  it('returns a stable token for the same session', async () => {
    const { app } = makeApp()
    const client = new Client(app)
    const first = (await client.get('/auth/csrf')).body.data.csrf_token
    const second = (await client.get('/auth/csrf')).body.data.csrf_token
    assert.equal(first, second)
  })

  it('rejects unsafe requests without a valid token with 419 and audits it', async () => {
    const { app, audit } = makeApp()
    const client = new Client(app)
    await client.get('/auth/csrf')
    const missing = await client.request('POST', '/auth/logout')
    assert.equal(missing.status, 419)
    assert.equal(missing.body.error.code, 'CSRF_INVALID')
    const wrong = await client.request('POST', '/auth/logout', { headers: { 'x-csrf-token': 'f'.repeat(64) } })
    assert.equal(wrong.status, 419)
    assert.deepEqual(audit.actions(), ['security.csrf_rejected', 'security.csrf_rejected'])
  })

  it('accepts a valid token and logout destroys the session cookie', async () => {
    const { app } = makeApp()
    const client = new Client(app)
    const { status, body, response } = await client.post('/auth/logout')
    assert.equal(status, 200)
    assert.deepEqual(body.data, { message: 'You have been signed out.' })
    assert.ok(response.cookies.some((line) => /^dc_session=deleted; expires=Thu, 01 Jan 1970/.test(line)))
  })

  it('does not share tokens across sessions', async () => {
    const { app } = makeApp()
    const alice = new Client(app)
    const bob = new Client(app)
    alice.csrf = (await alice.get('/auth/csrf')).body.data.csrf_token
    await bob.get('/auth/csrf')
    bob.csrf = alice.csrf
    assert.equal((await bob.request('POST', '/auth/logout')).status, 419)
  })

  it('expires idle sessions', async () => {
    const { app } = makeApp({ env: { SESSION_IDLE_MINUTES: '1' } })
    const client = new Client(app)
    await client.get('/auth/csrf')
    const [[, id]] = [...client.jar]
    const store = app.sessionStore
    const record = await store.load(id)
    record._last_activity -= 120
    await store.save(id, record, Math.floor(Date.now() / 1000) + 3600)
    const req = new ApiRequest({ path: '/api/v1/auth/me', cookies: { dc_session: id } })
    const response = await app.kernel.handle(req)
    assert.equal(response.status, 401)
    assert.equal(response.decoded().error.message, 'Please sign in to continue.')
  })
})

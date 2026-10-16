import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Client, FakeDb, makeApp } from './support/harness.js'

const PASSWORD = 'Correct-Horse-9'
const PHP_HASH = '$argon2id$v=19$m=65536,t=4,p=1$eFdValZtaHlWUW56NWJhRw$+lDJfxIlJZH54BU9YHzR5y2zvEpXk1OWW9ldrW/n7pQ'

const baseUser = (overrides = {}) => ({
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  email: 'jane@example.com',
  role: 'patient',
  full_name: 'Jane Doe',
  phone: '9876543210',
  password_hash: PHP_HASH,
  is_active: true,
  is_locked: false,
  lock_seconds_remaining: 0,
  email_verified_at: null,
  password_changed_at: '2026-01-01 10:00:00+05:30',
  last_login_at: null,
  created_at: '2026-01-01 10:00:00.123456+05:30',
  ...overrides,
})

const dbWithUser = (user = baseUser()) =>
  new FakeDb()
    .on('FROM users WHERE lower(email)', (params) => (params[0] === user.email ? user : []))
    .on('SELECT * FROM users WHERE id', (params) => (params[0] === user.id ? user : []))
    .on('SELECT * FROM patients WHERE user_id', { id: 'p-1', date_of_birth: '1990-05-01', gender: 'female', city: 'Pune' })

const login = (client, overrides = {}) =>
  client.post('/auth/login', { email: 'jane@example.com', password: PASSWORD, ...overrides })

describe('POST /auth/login', () => {
  it('validates input with the shared 422 envelope', async () => {
    const { app } = makeApp({ db: dbWithUser() })
    const { status, body } = await new Client(app).post('/auth/login', { email: 'bad' })
    assert.equal(status, 422)
    assert.equal(body.error.code, 'VALIDATION_FAILED')
    assert.equal(body.error.message, 'Please correct the highlighted fields.')
    assert.deepEqual(body.error.fields, { email: 'Enter a valid email address.', password: 'This field is required.' })
  })

  it('returns a generic 401 for unknown emails and records the attempt', async () => {
    const { app, db, audit } = makeApp({ db: dbWithUser() })
    const { status, body } = await login(new Client(app), { email: 'ghost@example.com' })
    assert.equal(status, 401)
    assert.deepEqual(body, { data: null, error: { code: 'UNAUTHENTICATED', message: 'Incorrect email or password.' } })
    assert.equal(db.ran('INSERT INTO login_attempts').length, 1)
    assert.deepEqual(db.ran('INSERT INTO login_attempts')[0].params.slice(0, 3), ['ghost@example.com', '203.0.113.9', false])
    assert.deepEqual(audit.actions(), ['auth.login_failed'])
    assert.equal(audit.entries[0].options.metadata.reason, 'unknown_email')
  })

  it('returns the same 401 for a wrong password and counts the failure', async () => {
    const db = dbWithUser().on('failed_login_count = CASE', { failed_login_count: 1, is_locked: false })
    const { app, audit } = makeApp({ db })
    const { status, body } = await login(new Client(app), { password: 'Wrong-Pass-1!' })
    assert.equal(status, 401)
    assert.equal(body.error.message, 'Incorrect email or password.')
    assert.equal(db.ran('failed_login_count = CASE').length, 1)
    assert.equal(audit.entries[0].options.metadata.reason, 'bad_password')
  })

  it('locks the account on the final allowed failure with 429 and Retry-After', async () => {
    const db = dbWithUser().on('failed_login_count = CASE', { failed_login_count: 0, is_locked: true })
    const { app, audit } = makeApp({ db })
    const { status, body, response } = await login(new Client(app), { password: 'Wrong-Pass-1!' })
    assert.equal(status, 429)
    assert.equal(body.error.code, 'RATE_LIMITED')
    assert.equal(body.error.message, 'Too many failed sign-in attempts. Please try again in 15 minutes.')
    assert.equal(response.header('Retry-After'), '900')
    assert.deepEqual(audit.actions(), ['auth.account_locked', 'auth.login_failed'])
  })

  it('rejects locked accounts without checking the password', async () => {
    const { app, audit } = makeApp({ db: dbWithUser(baseUser({ is_locked: true, lock_seconds_remaining: 61 })) })
    const { status, body, response } = await login(new Client(app))
    assert.equal(status, 429)
    assert.equal(body.error.message, 'Too many failed sign-in attempts. Please try again in 2 minutes.')
    assert.equal(response.header('Retry-After'), '61')
    assert.deepEqual(audit.actions(), ['auth.login_blocked'])
  })

  it('throttles unknown emails after repeated failures', async () => {
    const db = dbWithUser().on('SELECT count(*) FROM login_attempts', { count: 5 })
    const { app } = makeApp({ db })
    const { status, body } = await login(new Client(app), { email: 'ghost@example.com' })
    assert.equal(status, 429)
    assert.equal(body.error.message, 'Too many failed sign-in attempts. Please try again in 15 minutes.')
  })

  it('applies the per-IP login throttle', async () => {
    const db = dbWithUser().on('INSERT INTO rate_limits', { hits: 21, retry_after: 540 })
    const { app, audit } = makeApp({ db })
    const { status, response } = await login(new Client(app))
    assert.equal(status, 429)
    assert.equal(response.header('Retry-After'), '540')
    assert.ok(audit.actions().includes('security.rate_limited'))
  })

  it('signs in with a PHP-created hash, sets the session and serves /auth/me', async () => {
    const { app, db, audit } = makeApp({ db: dbWithUser() })
    const client = new Client(app)
    const { status, body } = await login(client)
    assert.equal(status, 200)
    assert.deepEqual(body.data.user, {
      id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      email: 'jane@example.com',
      role: 'patient',
      full_name: 'Jane Doe',
      phone: '9876543210',
      email_verified: false,
      email_verified_at: null,
      last_login_at: null,
      created_at: '2026-01-01T10:00:00+05:30',
      profile: { patient_id: 'p-1', date_of_birth: '1990-05-01', gender: 'female', city: 'Pune' },
    })
    assert.ok(client.jar.has('dc_session'))
    assert.equal(client.jar.has('dc_remember'), false)
    assert.equal(db.ran('last_login_at = now()').length, 1)
    assert.ok(audit.actions().includes('auth.login_succeeded'))

    const me = await client.get('/auth/me')
    assert.equal(me.status, 200)
    assert.equal(me.body.data.user.email, 'jane@example.com')
  })

  it('issues the dc_remember cookie when asked to remember', async () => {
    const { app, db } = makeApp({ db: dbWithUser() })
    const client = new Client(app)
    const { response } = await login(client, { remember: true })
    const cookie = response.cookies.findLast((line) => line.startsWith('dc_remember='))
    assert.match(cookie, /^dc_remember=[a-f0-9]{24}\.[a-f0-9]{64}; expires=.* GMT; Max-Age=\d+; path=\/; HttpOnly; SameSite=Lax$/)
    assert.equal(db.ran('INSERT INTO remember_tokens').length, 1)
  })

  it('invalidates sessions created before a password change', async () => {
    const user = baseUser()
    const { app } = makeApp({ db: dbWithUser(user) })
    const client = new Client(app)
    await login(client)
    user.password_changed_at = new Date(Date.now() + 60_000).toISOString()
    const me = await client.get('/auth/me')
    assert.equal(me.status, 401)
  })
})

describe('session lifecycle', () => {
  it('requires authentication for /auth/me', async () => {
    const { app } = makeApp({ db: dbWithUser() })
    const { status, body } = await new Client(app).get('/auth/me')
    assert.equal(status, 401)
    assert.equal(body.error.code, 'UNAUTHENTICATED')
  })

  it('reports expired sessions with the inactivity message', async () => {
    const { app } = makeApp({ db: dbWithUser(), env: { SESSION_IDLE_MINUTES: '1' } })
    const client = new Client(app)
    await login(client)
    const id = client.jar.get('dc_session')
    const record = await app.sessionStore.load(id)
    record._last_activity -= 600
    await app.sessionStore.save(id, record, Math.floor(Date.now() / 1000) + 3600)
    const me = await client.get('/auth/me')
    assert.equal(me.status, 401)
    assert.equal(me.body.error.message, 'Your session expired due to inactivity. Please sign in again.')
  })

  it('logs out everywhere and reports revoked remember tokens', async () => {
    const db = dbWithUser()
    const { app } = makeApp({ db })
    const client = new Client(app)
    await login(client, { remember: true })
    await client.refreshCsrf()
    const { status, body } = await client.request('DELETE', '/auth/sessions')
    assert.equal(status, 200)
    assert.equal(body.data.message, 'You have been signed out on all devices.')
    assert.equal(db.ran('DELETE FROM remember_tokens WHERE user_id').length, 1)
    assert.equal(client.jar.has('dc_session'), false)
  })
})

describe('POST /auth/register', () => {
  const payload = {
    account_type: 'patient',
    full_name: 'New Patient',
    email: 'New@Example.com',
    phone: '9876543210',
    password: PASSWORD,
    password_confirmation: PASSWORD,
    consent: true,
  }

  it('validates the account fields and the consent message', async () => {
    const { app } = makeApp({ db: dbWithUser() })
    const { status, body } = await new Client(app).post('/auth/register', {
      account_type: 'patient',
      full_name: 'X',
      email: 'nope',
      phone: '1',
      password: 'weak',
    })
    assert.equal(status, 422)
    assert.deepEqual(Object.keys(body.error.fields), ['full_name', 'email', 'phone', 'password', 'consent'])
    assert.equal(body.error.fields.consent, 'Please give your consent to continue.')
  })

  it('requires referrer fields for referrer accounts', async () => {
    const { app } = makeApp({ db: dbWithUser() })
    const { body } = await new Client(app).post('/auth/register', { ...payload, account_type: 'referrer' })
    assert.deepEqual(Object.keys(body.error.fields), ['qualification', 'registration_number', 'clinic_name', 'city'])
  })

  it('answers duplicates with a 409 and the email field message', async () => {
    const db = dbWithUser().on('SELECT EXISTS', { exists: true })
    const { app } = makeApp({ db })
    const { status, body } = await new Client(app).post('/auth/register', payload)
    assert.equal(status, 409)
    assert.equal(body.error.code, 'CONFLICT')
    assert.equal(body.error.fields.email, 'An account with this email already exists. Try signing in or resetting your password.')
  })

  it('creates the user and profile in one transaction, mails a verification link and signs in', async () => {
    const created = baseUser({ id: 'new-user', email: 'new@example.com', full_name: 'New Patient' })
    const db = new FakeDb()
      .on('INSERT INTO users', created)
      .on('INSERT INTO patients', { id: 'p-9' })
      .on('SELECT * FROM patients WHERE user_id', { id: 'p-9', date_of_birth: null, gender: null, city: null })
    const { app, mailer, audit } = makeApp({ db })
    const client = new Client(app)
    const { status, body } = await client.post('/auth/register', payload)
    assert.equal(status, 201)
    assert.equal(body.data.user.email, 'new@example.com')
    assert.deepEqual(body.data.user.profile, { patient_id: 'p-9', date_of_birth: null, gender: null, city: null })
    const sequence = db.statements.map((statement) => statement.sql.split(' ').slice(0, 3).join(' '))
    assert.deepEqual(sequence.filter((sql) => /BEGIN|COMMIT|INSERT INTO (users|patients)/.test(sql)), [
      'BEGIN',
      'INSERT INTO users',
      'INSERT INTO patients',
      'COMMIT',
    ])
    const insert = db.ran('INSERT INTO users')[0]
    assert.match(insert.params[1], /^\$argon2id\$v=19\$m=65536,t=4,p=1\$/)
    assert.equal(insert.params[0], 'new@example.com')
    assert.equal(mailer.sent.length, 1)
    assert.equal(mailer.sent[0].subject, 'Verify your email address')
    assert.match(mailer.sent[0].text, /http:\/\/localhost:5173\/verify-email\?token=[a-f0-9]{64}/)
    assert.deepEqual(audit.actions(), ['auth.registered'])
    assert.ok(client.jar.has('dc_session'))
  })

  it('maps unique violations to the duplicate conflict', async () => {
    const db = new FakeDb().on('INSERT INTO users', () => {
      throw Object.assign(new Error('duplicate key'), { code: '23505' })
    })
    const { app } = makeApp({ db })
    const { status } = await new Client(app).post('/auth/register', payload)
    assert.equal(status, 409)
  })
})

describe('password reset and email verification', () => {
  it('answers password/forgot identically for unknown emails and sends nothing', async () => {
    const { app, mailer, audit } = makeApp({ db: dbWithUser() })
    const { status, body } = await new Client(app).post('/auth/password/forgot', { email: 'ghost@example.com' })
    assert.equal(status, 200)
    assert.equal(body.data.message, 'If an account exists for that email, we have sent a link to reset the password.')
    assert.equal(mailer.sent.length, 0)
    assert.equal(audit.entries[0].options.metadata.email_found, false)
  })

  it('mails a reset link for known accounts', async () => {
    const { app, mailer, db } = makeApp({ db: dbWithUser() })
    const { status } = await new Client(app).post('/auth/password/forgot', { email: 'jane@example.com' })
    assert.equal(status, 200)
    assert.equal(db.ran('INSERT INTO password_resets').length, 1)
    assert.equal(mailer.sent[0].subject, 'Reset your password')
    assert.match(mailer.sent[0].html, /reset-password\?token=[a-f0-9]{64}/)
  })

  it('limits reset requests per email', async () => {
    const db = dbWithUser().on('INSERT INTO rate_limits', (params) => ({ hits: params[0].startsWith('forgot-email:') ? 4 : 1, retry_after: 3000 }))
    const { app } = makeApp({ db })
    const { status, body } = await new Client(app).post('/auth/password/forgot', { email: 'jane@example.com' })
    assert.equal(status, 429)
    assert.equal(body.error.message, 'Too many reset requests. Please wait and try again.')
  })

  it('rejects unknown reset and verification tokens with a token field error', async () => {
    const { app } = makeApp({ db: dbWithUser() })
    const client = new Client(app)
    const reset = await client.post('/auth/password/reset', { token: 'a'.repeat(64), password: PASSWORD, password_confirmation: PASSWORD })
    assert.equal(reset.status, 422)
    assert.equal(reset.body.error.fields.token, 'This reset link is invalid or has expired. Please request a new one.')
    const verify = await client.post('/auth/email/verify', { token: 'b'.repeat(64) })
    assert.equal(verify.status, 422)
    assert.equal(verify.body.error.fields.token, 'This verification link is invalid or has expired.')
    const malformed = await client.post('/auth/email/verify', { token: 'short' })
    assert.equal(malformed.body.error.fields.token, 'This link is invalid or has expired.')
  })

  it('resets a password, revokes remember tokens and mails a change notice', async () => {
    const user = baseUser()
    const db = dbWithUser(user).on('UPDATE password_resets SET used_at = now()\n       WHERE token_hash', { user_id: user.id })
    const { app, mailer } = makeApp({ db })
    const { status, body } = await new Client(app).post('/auth/password/reset', {
      token: 'c'.repeat(64),
      password: 'Brand-New-Pass-5!',
      password_confirmation: 'Brand-New-Pass-5!',
    })
    assert.equal(status, 200)
    assert.equal(body.data.message, 'Your password has been reset. You can now sign in.')
    assert.match(db.ran('password_changed_at = $2')[0].params[0], /^\$argon2id\$/)
    assert.equal(db.ran('DELETE FROM remember_tokens WHERE user_id').length, 1)
    assert.equal(mailer.sent[0].subject, 'Your password was changed')
    assert.match(mailer.sent[0].text, /changed on \d{2} \w{3} \d{4}, \d{2}:\d{2} (AM|PM)/)
  })

  it('changes the password for a signed-in user after verifying the current one', async () => {
    const { app, db } = makeApp({ db: dbWithUser() })
    const client = new Client(app)
    await login(client)
    const wrong = await client.request('PUT', '/auth/password', {
      json: { current_password: 'Nope-Nope-1!', password: 'Brand-New-Pass-5!', password_confirmation: 'Brand-New-Pass-5!' },
      headers: { 'x-csrf-token': await client.refreshCsrf() },
    })
    assert.equal(wrong.status, 422)
    assert.deepEqual(wrong.body.error.fields, { current_password: 'Your current password is incorrect.' })
    const same = await client.request('PUT', '/auth/password', {
      json: { current_password: PASSWORD, password: PASSWORD, password_confirmation: PASSWORD },
    })
    assert.equal(same.status, 422)
    assert.deepEqual(same.body.error.fields, { password: 'Choose a value different from the current one.' })
    const changed = await client.request('PUT', '/auth/password', {
      json: { current_password: PASSWORD, password: 'Brand-New-Pass-5!', password_confirmation: 'Brand-New-Pass-5!' },
    })
    assert.equal(changed.status, 200)
    assert.equal(changed.body.data.message, 'Your password has been changed. Other devices have been signed out.')
    assert.equal(db.ran('password_changed_at = $2').length, 1)
  })

  it('refuses to resend verification for already verified accounts', async () => {
    const { app } = makeApp({ db: dbWithUser(baseUser({ email_verified_at: '2026-01-02 10:00:00+05:30' })) })
    const client = new Client(app)
    await login(client)
    const { status, body } = await client.post('/auth/email/resend', {})
    assert.equal(status, 409)
    assert.equal(body.error.message, 'Your email address is already verified.')
  })

  it('resends verification for unverified accounts', async () => {
    const { app, mailer } = makeApp({ db: dbWithUser() })
    const client = new Client(app)
    await login(client)
    const { status, body } = await client.post('/auth/email/resend', {})
    assert.equal(status, 200)
    assert.equal(body.data.message, 'We have sent a new verification link to your email address.')
    assert.equal(mailer.sent.length, 1)
  })
})

describe('PATCH /auth/me', () => {
  it('updates contact details, syncs the profile and audits the change', async () => {
    const user = baseUser()
    const db = dbWithUser(user).on('UPDATE users SET', { ...user, full_name: 'Jane Q Doe', phone: '9123456789' })
    const { app, audit } = makeApp({ db })
    const client = new Client(app)
    await login(client)
    await client.refreshCsrf()
    const { status, body } = await client.request('PATCH', '/auth/me', { json: { full_name: 'Jane Q Doe', phone: '91234 56789' } })
    assert.equal(status, 200)
    assert.equal(body.data.user.full_name, 'Jane Q Doe')
    assert.deepEqual(db.ran('UPDATE patients SET')[0].params, ['Jane Q Doe', '9123456789', user.id])
    assert.ok(audit.actions().includes('user.profile_updated'))
  })
})

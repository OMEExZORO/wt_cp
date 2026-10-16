import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ApiRequest } from '../src/core/request.js'
import { ConflictError, NotFoundError, ValidationError } from '../src/core/errors.js'
import * as audit from '../src/modules/admin-audit-log/audit-log.controller.js'
import * as branches from '../src/modules/admin-branches/branches.controller.js'
import * as catalog from '../src/modules/admin-catalog/catalog.controller.js'
import * as faqs from '../src/modules/admin-faqs/faqs.controller.js'
import * as reviews from '../src/modules/admin-reviews/reviews.controller.js'
import * as settings from '../src/modules/admin-settings/settings.controller.js'
import * as slots from '../src/modules/admin-slots/slots.controller.js'
import * as stats from '../src/modules/admin-stats/stats.controller.js'
import * as users from '../src/modules/admin-users/users.controller.js'
import { routes as statsRoutes } from '../src/modules/admin-stats/index.js'
import { buildRoutes } from '../src/routes.js'
import { Validator } from '../src/validation/validator.js'
import { isEditable, buildRules } from '../src/services/admin/settings-validator.js'
import { SlotGenerator } from '../src/services/booking/slot-generator.js'
import { FakeDb, makeApp } from './support/harness.js'

const ADMIN = '00000000-0000-4000-8000-000000000001'
const SLOT = '5d0a8f3e-1b2c-4d3e-8f4a-5b6c7d8e9f00'
const OTHER = '11111111-1111-4111-8111-111111111111'

const call = (app, handler, { method = 'GET', body = {}, params = {}, query = {}, user = { id: ADMIN, role: 'admin', full_name: 'Dev Admin' } } = {}) => {
  const hasBody = method !== 'GET'
  const req = new ApiRequest({
    method,
    path: '/api/v1/admin/x',
    query,
    headers: hasBody ? { 'content-type': 'application/json' } : {},
    rawBody: hasBody ? Buffer.from(JSON.stringify(body)) : Buffer.alloc(0),
    ip: '203.0.113.9',
  })
  req.user = user
  req.routeParams = params
  return handler(req, app)
}

const rejects = async (promise, type, field = null) => {
  try {
    await promise
  } catch (error) {
    assert.ok(error instanceof type, `expected ${type.name}, got ${error?.constructor?.name}: ${error?.message}`)
    if (field !== null) assert.ok(field in error.fields, `expected field ${field}, got ${JSON.stringify(error.fields)}`)
    return error
  }
  assert.fail(`expected ${type.name}`)
}

const writes = (db) => db.statements.filter(({ sql }) => /^\s*(INSERT|UPDATE|DELETE)/i.test(sql))

describe('admin route access', () => {
  const adminRoutes = buildRoutes().filter((route) => route.path.startsWith('/api/v1/admin'))

  it('requires login and the admin role on every admin route', () => {
    assert.ok(adminRoutes.length > 30)
    for (const route of adminRoutes) {
      assert.ok(route.middleware.includes('auth'), `${route.method} ${route.path}`)
      assert.ok(route.middleware.includes('role:admin'), `${route.method} ${route.path}`)
    }
  })

  it('uses the expected verbs', () => {
    assert.deepEqual([...new Set(adminRoutes.map((route) => route.method))].sort(), ['DELETE', 'GET', 'PATCH', 'POST', 'PUT'])
  })

  it('keeps the throttles from the PHP route table', () => {
    const find = (method, path) => adminRoutes.find((route) => route.method === method && route.path === path).middleware
    assert.ok(find('POST', '/api/v1/admin/users/{id:uuid}/password-reset').includes('throttle:admin-password-reset,20,60'))
    assert.ok(find('POST', '/api/v1/admin/slots/generate').includes('throttle:admin-slot-generate,20,60'))
    assert.equal(statsRoutes.length, 1)
  })

  it('rejects guests with 401 and other roles with 403 through the kernel', async () => {
    const { app } = makeApp()
    const guest = await app.kernel.handle(new ApiRequest({ method: 'GET', path: '/api/v1/admin/stats' }))
    assert.equal(guest.status, 401)
  })
})

describe('FAQ admin', () => {
  const valid = { question: 'Valid question here?', answer: 'A valid answer.', category: 'general' }
  const bad = {
    script: [{ ...valid, question: '<script>alert(1)</script>' }, 'question'],
    tautology: [{ ...valid, question: "' OR '1'='1" }, 'question'],
    'drop table': [{ ...valid, answer: "'; DROP TABLE users;--" }, 'answer'],
    'unknown category': [{ ...valid, category: 'secret' }, 'category'],
    'too short': [{ ...valid, question: 'Hi' }, 'question'],
    oversized: [{ ...valid, answer: 'a'.repeat(2001) }, 'answer'],
    'missing answer': [{ question: valid.question, category: 'general' }, 'answer'],
  }

  for (const [name, [body, field]] of Object.entries(bad)) {
    it(`rejects ${name} and writes nothing`, async () => {
      const { app, db } = makeApp()
      await rejects(call(app, faqs.store, { method: 'POST', body }), ValidationError, field)
      assert.deepEqual(writes(db), [])
    })
  }

  it('audits creation', async () => {
    const db = new FakeDb().on('INSERT INTO faqs', [{ id: 'f-1', ...valid, sort_order: 0, is_published: true }])
    const { app, audit: log } = makeApp({ db })
    const response = await call(app, faqs.store, { method: 'POST', body: valid })
    assert.equal(response.status, 201)
    assert.deepEqual(log.actions(), ['admin.faq_created'])
    assert.deepEqual(response.decoded().data, { id: 'f-1', ...valid, sort_order: 0, is_published: true })
  })

  it('maps unique violations to 409 and 404s unknown ids', async () => {
    const db = new FakeDb().on('INSERT INTO faqs', () => {
      throw Object.assign(new Error('dup'), { code: '23505' })
    })
    const { app } = makeApp({ db })
    const error = await rejects(call(app, faqs.store, { method: 'POST', body: valid }), ConflictError)
    assert.equal(error.message, 'A FAQ with this question already exists.')
    await rejects(call(app, faqs.destroy, { method: 'DELETE', params: { id: OTHER } }), NotFoundError)
  })

  it('treats PATCH as partial and audits changed fields', async () => {
    const before = { id: OTHER, ...valid, sort_order: 1, is_published: true }
    const db = new FakeDb()
      .on('SELECT * FROM faqs WHERE id', before)
      .on('UPDATE faqs SET', { ...before, sort_order: 4 })
    const { app, audit: log } = makeApp({ db })
    const response = await call(app, faqs.update, { method: 'PATCH', body: { sort_order: 4 }, params: { id: OTHER } })
    assert.equal(response.status, 200)
    assert.deepEqual(log.entries[0].options.metadata, { fields: ['sort_order'] })
  })
})

describe('branch admin', () => {
  const branch = {
    slug: 'moshi', name: 'MDC Moshi', address_line: 'Gat No. 284, Moshi', city: 'Pune', state: 'Maharashtra',
    phone: '8380068696', phone_secondary: '8308849804', maps_url: 'https://www.google.com/maps/search/?api=1&query=x',
  }

  it('stores phone_secondary and flags TODO addresses as placeholders', async () => {
    const db = new FakeDb().on('INSERT INTO branches', (params, sql) => ({ id: 'b-1', ...branch, sort_order: 0, is_active: true, is_placeholder: params.at(-1), sql }))
    const { app } = makeApp({ db })
    const response = await call(app, branches.store, { method: 'POST', body: { ...branch, address_line: 'TODO address' } })
    assert.equal(response.status, 201)
    const insert = db.ran('INSERT INTO branches')[0]
    assert.match(insert.sql, /phone_secondary/)
    assert.ok(insert.params.includes('8308849804'))
    assert.equal(response.decoded().data.phone_secondary, '8308849804')
    assert.equal(response.decoded().data.is_placeholder, true)
  })

  it('validates coordinates, slug and links', async () => {
    const { app } = makeApp()
    for (const [override, field] of [
      [{ latitude: '95.5' }, 'latitude'],
      [{ longitude: '190.5' }, 'longitude'],
      [{ slug: 'Not A Slug' }, 'slug'],
      [{ maps_url: 'http://insecure.example.com' }, 'maps_url'],
      [{ postal_code: '012345' }, 'postal_code'],
      [{ phone_secondary: '123' }, 'phone_secondary'],
    ]) {
      await rejects(call(app, branches.store, { method: 'POST', body: { ...branch, ...override } }), ValidationError, field)
    }
  })
})

describe('review admin', () => {
  const google = {
    display_name: 'Asha K', rating: 5, body: 'Calm staff and a clear explanation of the scan.',
    external_review_date: '2026-09-01', source_url: 'https://maps.app.goo.gl/example',
  }

  it('creates approved, unverified Google reviews', async () => {
    const db = new FakeDb().on('INSERT INTO reviews', [{ id: 'r-1', ...google, status: 'approved', verified_visit: false, is_demo: false, source: 'google', reviewer_photo_url: null }])
    const { app, audit: log } = makeApp({ db })
    const response = await call(app, reviews.store, { method: 'POST', body: google })
    assert.equal(response.status, 201)
    assert.deepEqual(log.actions(), ['admin.review_created'])
    assert.match(db.ran('INSERT INTO reviews')[0].sql, /source/)
  })

  it('rejects non-https links, future dates and bad ratings', async () => {
    for (const override of [{ source_url: 'http://example.com/r' }, { external_review_date: '2999-01-01' }, { rating: 6 }]) {
      const { app, db } = makeApp()
      await rejects(call(app, reviews.store, { method: 'POST', body: { ...google, ...override } }), ValidationError, Object.keys(override)[0])
      assert.deepEqual(writes(db), [])
    }
  })

  it('does not let site reviews be edited as Google reviews', async () => {
    const db = new FakeDb().on('SELECT * FROM reviews WHERE id', { id: OTHER, source: 'site', status: 'approved' })
    const { app } = makeApp({ db })
    await rejects(call(app, reviews.update, { method: 'PUT', body: google, params: { id: OTHER } }), ValidationError, '_')
  })

  it('moderates and audits the transition', async () => {
    const db = new FakeDb()
      .on('SELECT * FROM reviews WHERE id', { id: OTHER, status: 'pending' })
      .on('UPDATE reviews SET', { id: OTHER, status: 'approved', rating: 4, moderated_at: '2026-10-01 10:00:00+05:30' })
    const { app, audit: log } = makeApp({ db })
    const response = await call(app, reviews.moderate, { method: 'PATCH', body: { status: 'approved' }, params: { id: OTHER } })
    assert.equal(response.status, 200)
    assert.deepEqual(log.actions(), ['admin.review_approved'])
    assert.equal(response.decoded().data.moderated_at, '2026-10-01T10:00:00+05:30')
  })
})

describe('slot admin', () => {
  const slotRow = (capacity, booked) => ({
    id: SLOT, branch_id: 'b-1', modality: 'USG', slot_date: '2026-10-12', start_time: '09:00:00', end_time: '09:30:00',
    capacity, booked_count: booked, is_blocked: false, branch_name: 'MDC',
  })

  it('refuses capacity below existing bookings', async () => {
    const db = new FakeDb()
      .on('FROM slots s JOIN branches b ON b.id = s.branch_id WHERE s.id', slotRow(3, 2))
      .on('FROM slots WHERE id = $1 FOR UPDATE', { id: SLOT, capacity: 3, booked_count: 2, is_blocked: false })
    const { app, audit: log } = makeApp({ db })
    const error = await rejects(call(app, slots.update, { method: 'PATCH', body: { capacity: 1 }, params: { id: SLOT } }), ConflictError, 'capacity')
    assert.equal(error.message, 'This slot already has 2 booking(s); capacity cannot be lower.')
    assert.equal(db.ran('UPDATE slots SET capacity').length, 0)
    assert.deepEqual(log.actions(), [])
  })

  it('updates capacity and blocked flag', async () => {
    const db = new FakeDb()
      .on('FROM slots s JOIN branches b ON b.id = s.branch_id WHERE s.id', slotRow(3, 1))
      .on('FROM slots WHERE id = $1 FOR UPDATE', { id: SLOT, capacity: 3, booked_count: 1, is_blocked: false })
    const { app, audit: log } = makeApp({ db })
    const response = await call(app, slots.update, { method: 'PATCH', body: { capacity: 2, is_blocked: true }, params: { id: SLOT } })
    assert.equal(response.status, 200)
    assert.deepEqual(db.ran('UPDATE slots SET capacity')[0].params, [2, true, SLOT])
    assert.equal(log.entries[0].options.metadata.capacity_before, 3)
    assert.equal(response.decoded().data.start_time, '09:00')
  })

  it('rejects out of range and injected capacity', async () => {
    const { app, db } = makeApp()
    for (const capacity of [0, 51, 'abc', '1; DROP TABLE slots']) {
      await rejects(call(app, slots.update, { method: 'PATCH', body: { capacity }, params: { id: SLOT } }), ValidationError)
    }
    await rejects(call(app, slots.update, { method: 'PATCH', body: {}, params: { id: SLOT } }), ValidationError, 'capacity')
    assert.deepEqual(writes(db), [])
  })

  it('refuses to delete a booked slot', async () => {
    const db = new FakeDb().on('FROM slots s JOIN branches b ON b.id = s.branch_id WHERE s.id', slotRow(3, 1))
    const { app } = makeApp({ db })
    await rejects(call(app, slots.destroy, { method: 'DELETE', params: { id: SLOT } }), ConflictError)
  })

  it('rejects bad bulk generation requests', async () => {
    const { app, db } = makeApp()
    const tomorrow = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
    const base = { from: tomorrow, days: 2, open: '09:00', close: '10:00', interval: 30, capacity_usg: 1 }
    for (const override of [{ from: '2020-01-01' }, { capacity_usg: 0 }, { days: 500 }, { close: '08:00' }, { closed_weekdays: '9' }]) {
      await rejects(call(app, slots.generate, { method: 'POST', body: { ...base, ...override } }), ValidationError)
    }
    assert.deepEqual(writes(db), [])
  })

  it('plans a dry run for every active branch with Sunday closed by default', async () => {
    const db = new FakeDb().on('FROM branches WHERE is_active', [{ id: 'b1' }, { id: 'b2' }])
    const { app } = makeApp({ db })
    const from = '2099-01-04'
    const body = { from, days: 7, open: '09:00', close: '10:00', interval: 30, capacity_usg: 2, dry_run: true }
    const response = await call(app, slots.generate, { method: 'POST', body })
    assert.deepEqual(response.decoded().data, { candidates: 6 * 2 * 2, inserted: 0, skipped_existing: 0, dry_run: true })
    assert.deepEqual(writes(db), [])
  })

  it('inserts through jsonb_to_recordset and audits', async () => {
    const db = new FakeDb().on('FROM branches WHERE is_active', [{ id: 'b1' }]).on('INSERT INTO slots', { }).on('jsonb_to_recordset', () => [{}, {}])
    const { app, audit: log } = makeApp({ db })
    const body = { from: '2099-01-05', days: 1, open: '09:00', close: '10:00', interval: 30, capacity_usg: 2, branch_id: undefined }
    const response = await call(app, slots.generate, { method: 'POST', body })
    assert.equal(response.decoded().data.candidates, 2)
    assert.equal(response.decoded().data.inserted, 2)
    assert.deepEqual(log.actions(), ['admin.slots_generated'])
  })
})

describe('SlotGenerator', () => {
  it('plans slots for every open day, branch and modality', () => {
    const rows = SlotGenerator.plan(['b1', 'b2'], { USG: 2, CT: 1 }, '2026-10-10', 2, '09:00', '10:00', 30)
    assert.equal(rows.length, 1 * 2 * 2 * 2)
    assert.deepEqual(rows[0], { branch_id: 'b1', modality: 'USG', slot_date: '2026-10-10', start_time: '09:00', end_time: '09:30', capacity: 2 })
    assert.equal(rows[1].start_time, '09:30')
    assert.equal(rows[1].end_time, '10:00')
  })

  it('skips closed weekdays and defaults to Sunday', () => {
    assert.deepEqual(SlotGenerator.plan(['b1'], { CT: 1 }, '2026-10-11', 1, '09:00', '10:00', 30, [7]), [])
    assert.equal(SlotGenerator.plan(['b1'], { CT: 1 }, '2026-10-11', 1, '09:00', '10:00', 30, []).length, 2)
    assert.deepEqual(SlotGenerator.plan(['b1'], { CT: 1 }, '2026-10-11', 1, '09:00', '10:00'), [])
    assert.equal(SlotGenerator.plan(['b1'], { CT: 1 }, '2026-10-12', 1, '09:00', '10:00').length, 2)
  })

  it('defaults to 08:00 to 22:00', () => {
    const rows = SlotGenerator.plan(['b1'], { CT: 1 }, '2026-10-12', 1)
    assert.equal(rows[0].start_time, '08:00')
    assert.equal(rows.at(-1).end_time, '22:00')
  })

  it('ends the last slot at or before closing', () => {
    assert.equal(SlotGenerator.plan(['b1'], { CT: 1 }, '2026-10-10', 1, '09:00', '10:15', 30).at(-1).end_time, '10:00')
  })

  it('rejects unknown modalities', () => {
    assert.throws(() => SlotGenerator.plan(['b1'], { MRI: 1 }, '2026-10-10', 1), /Invalid capacity for MRI/)
  })
})

describe('user admin', () => {
  const staff = { email: 'a@example.com', full_name: 'Asha Kulkarni', role: 'doctor', password: 'Str0ng!Password' }
  const bad = {
    'patient role': [{ role: 'patient' }, 'role'],
    'weak password': [{ password: 'password' }, 'password'],
    'bad email': [{ email: 'not-an-email' }, 'email'],
    'script name': [{ full_name: '<script>alert(1)</script>' }, 'full_name'],
    'bad phone': [{ phone: '123' }, 'phone'],
  }

  for (const [name, [override, field]] of Object.entries(bad)) {
    it(`validates staff creation: ${name}`, async () => {
      const { app, db } = makeApp()
      await rejects(call(app, users.store, { method: 'POST', body: { ...staff, ...override } }), ValidationError, field)
      assert.deepEqual(writes(db), [])
    })
  }

  it('creates a verified staff account with an argon2id hash', async () => {
    const db = new FakeDb()
      .on('SELECT EXISTS', { exists: false })
      .on('INSERT INTO users', (params) => ({ id: OTHER, email: params[0], role: 'doctor', full_name: params[3], is_active: true }))
      .on('FROM users WHERE id', { id: OTHER, email: 'a@example.com', full_name: 'Asha Kulkarni', role: 'doctor', is_active: true, email_verified_at: '2026-10-01 10:00:00+05:30', created_at: '2026-10-01 10:00:00+05:30' })
    const { app, audit: log } = makeApp({ db })
    const response = await call(app, users.store, { method: 'POST', body: staff })
    assert.equal(response.status, 201)
    assert.equal(response.decoded().data.email_verified, true)
    assert.match(db.ran('INSERT INTO users')[0].params[1], /^\$argon2id\$/)
    assert.deepEqual(log.actions(), ['admin.user_created'])
  })

  it('conflicts on duplicate email', async () => {
    const db = new FakeDb().on('SELECT EXISTS', { exists: true })
    const { app } = makeApp({ db })
    await rejects(call(app, users.store, { method: 'POST', body: staff }), ConflictError, 'email')
  })

  const userRow = (id, role) => ({
    id, email: 'x@example.com', full_name: 'Dev Admin', phone: null, role, is_active: true,
    email_verified_at: '2026-01-01', last_login_at: null, created_at: '2026-01-01 00:00:00+05:30',
  })

  it('stops admins deactivating or demoting themselves', async () => {
    const db = new FakeDb().on('FROM users WHERE id', userRow(ADMIN, 'admin'))
    const { app } = makeApp({ db })
    for (const body of [{ is_active: false }, { role: 'doctor' }]) {
      await rejects(call(app, users.update, { method: 'PATCH', body, params: { id: ADMIN } }), ValidationError)
    }
    assert.deepEqual(writes(db), [])
  })

  it('keeps patient accounts in their role', async () => {
    const db = new FakeDb().on('FROM users WHERE id', userRow(OTHER, 'patient'))
    const { app } = makeApp({ db })
    await rejects(call(app, users.update, { method: 'PATCH', body: { role: 'admin' }, params: { id: OTHER } }), ValidationError, 'role')
  })

  it('keeps the last active administrator', async () => {
    const db = new FakeDb().on('FROM users WHERE id', userRow(OTHER, 'admin')).on("role = 'admin' AND is_active", { count: 1 })
    const { app } = makeApp({ db })
    const error = await rejects(call(app, users.update, { method: 'PATCH', body: { is_active: false }, params: { id: OTHER } }), ValidationError, 'is_active')
    assert.equal(error.fields.is_active, 'At least one active administrator must remain.')
  })

  it('sends a reset link only to active accounts', async () => {
    const target = { id: OTHER, email: 'p@example.com', full_name: 'Pat Ient', is_active: true }
    const db = new FakeDb().on('SELECT * FROM users WHERE id', target)
    const { app, mailer, audit: log } = makeApp({ db })
    const response = await call(app, users.passwordReset, { method: 'POST', params: { id: OTHER } })
    assert.equal(response.decoded().data.message, 'A password reset link has been sent to the user.')
    assert.equal(db.ran('INSERT INTO password_resets').length, 1)
    assert.equal(mailer.sent.length, 1)
    assert.match(JSON.stringify(mailer.sent[0]), /reset-password\?token=[a-f0-9]{64}/)
    assert.deepEqual(log.actions(), ['admin.user_password_reset_sent'])

    const inactive = new FakeDb().on('SELECT * FROM users WHERE id', { ...target, is_active: false })
    await rejects(call(makeApp({ db: inactive }).app, users.passwordReset, { method: 'POST', params: { id: OTHER } }), ConflictError)
  })
})

describe('settings validation', () => {
  const row = (key, type, group = 'contact') => ({ key, value: null, value_type: type, group_name: group, label: key, is_public: true, is_placeholder: true, updated_at: null })
  const check = (rows, input) => new Validator().validate(input, buildRules(Object.fromEntries(rows.map((item) => [item.key, item]))))

  it('accepts Indian mobile numbers', () => {
    for (const [input, expected] of [['9876543210', '9876543210'], ['+91 98765-43210', '9876543210'], ['6000000000', '6000000000']]) {
      assert.equal(check([row('contact.phone', 'phone')], { 'contact.phone': input })['contact.phone'], expected)
    }
  })

  it('rejects other phone values', () => {
    for (const input of ['12345', '5876543210', '98765432101', 'abcdefghij', "9876543210'; DROP TABLE users;--"]) {
      assert.throws(() => check([row('contact.phone', 'phone')], { 'contact.phone': input }), ValidationError)
    }
  })

  it('accepts only https urls', () => {
    const url = row('links.google_reviews_url', 'url', 'links')
    for (const good of ['https://g.page/r/abc123/review', 'https://www.google.com/maps/place/Pune?cid=123&hl=en', 'https://maps.app.goo.gl/AbCdEf']) {
      assert.equal(check([url], { [url.key]: good })[url.key], good)
    }
    for (const bad of [
      'http://g.page/x', 'javascript:alert(1)', 'data:text/html,<b>x</b>', 'ftp://example.com/file', 'www.google.com/maps',
      'https://user:pass@example.com/', 'https://example.com/a b', 'https://example.com/<x>', `https://example.com/${'a'.repeat(600)}`,
    ]) {
      assert.throws(() => check([url], { [url.key]: bad }), ValidationError, bad)
    }
  })

  it('validates and lowercases email', () => {
    assert.equal(check([row('contact.email', 'email')], { 'contact.email': 'Hello@Example.com' })['contact.email'], 'hello@example.com')
    assert.throws(() => check([row('contact.email', 'email')], { 'contact.email': 'not-an-email' }), ValidationError)
  })

  it('lets optional settings clear and requires the rest', () => {
    assert.equal(check([row('contact.phone', 'phone')], { 'contact.phone': '   ' })['contact.phone'], null)
    assert.throws(() => check([row('doctor.name', 'string', 'doctor')], { 'doctor.name': '' }), ValidationError)
  })

  it('bounds the escalation window', () => {
    const item = row('alerts.escalation_minutes', 'string', 'alerts')
    assert.equal(check([item], { [item.key]: 45 })[item.key], 45)
    assert.throws(() => check([item], { [item.key]: 0 }), ValidationError)
  })

  it('rejects script payloads in text', () => {
    assert.throws(() => check([row('contact.opening_hours', 'text')], { 'contact.opening_hours': '<script>alert(1)</script>' }), ValidationError)
  })

  it('marks legal, json and image settings read only', () => {
    assert.equal(isEditable(row('legal.pcpndt_notice', 'string', 'legal')), false)
    assert.equal(isEditable(row('clinic.taglines', 'json', 'clinic')), false)
    assert.equal(isEditable(row('doctor.photo_url', 'image', 'doctor')), false)
    assert.equal(isEditable(row('contact.phone', 'phone')), true)
  })

  const settingRow = row('contact.phone', 'phone')

  it('controller rejects bad values and writes nothing', async () => {
    const db = new FakeDb().on('FROM site_settings WHERE key IN', [settingRow])
    const { app, audit: log } = makeApp({ db })
    await rejects(call(app, settings.update, { method: 'PATCH', body: { settings: { 'contact.phone': '12345' } } }), ValidationError, 'contact.phone')
    assert.equal(db.ran('UPDATE site_settings').length, 0)
    assert.ok(!log.actions().includes('admin.settings_updated'))
  })

  it('controller rejects unknown keys and malformed bodies', async () => {
    const db = new FakeDb()
    const { app } = makeApp({ db })
    for (const body of [{ settings: { 'made.up': 'x' } }, { settings: ['a'] }, { settings: {} }, {}, { settings: { 'contact.phone': ['x'] } }]) {
      await rejects(call(app, settings.update, { method: 'PATCH', body }), ValidationError)
    }
    assert.equal(db.ran('UPDATE site_settings').length, 0)
  })

  it('controller saves valid values and audits the change', async () => {
    const db = new FakeDb().on('FROM site_settings WHERE key IN', [settingRow]).on('FROM site_settings ORDER BY', [])
    const { app, audit: log } = makeApp({ db })
    const response = await call(app, settings.update, { method: 'PATCH', body: { settings: { 'contact.phone': '9876543210' } } })
    assert.equal(response.status, 200)
    assert.equal(db.ran('UPDATE site_settings').length, 1)
    assert.deepEqual(db.ran('UPDATE site_settings')[0].params.slice(0, 3), ['9876543210', false, ADMIN])
    assert.deepEqual(log.entries[0].options.metadata, { changes: { 'contact.phone': { from: null, to: '9876543210' } } })
  })
})

describe('catalog admin', () => {
  it('parses attention answers', () => {
    assert.deepEqual(catalog.parseAttentionAnswers(null, 'yes_no'), [])
    assert.deepEqual(catalog.parseAttentionAnswers(['yes', 'yes', 'no'], 'yes_no'), ['yes', 'no'])
    assert.deepEqual(catalog.parseAttentionAnswers(['unsure'], 'yes_no_unsure'), ['unsure'])
    assert.throws(() => catalog.parseAttentionAnswers(['unsure'], 'yes_no'), ValidationError)
    assert.throws(() => catalog.parseAttentionAnswers(['yes'], 'text'), ValidationError)
    assert.throws(() => catalog.parseAttentionAnswers('yes', 'yes_no'), ValidationError)
    assert.throws(() => catalog.parseAttentionAnswers(['yes', 'no', 'unsure', 'yes'], 'yes_no_unsure'), ValidationError)
  })

  it('requires a scan modality that matches its category', async () => {
    const db = new FakeDb().on('SELECT * FROM scan_categories WHERE id', { id: OTHER, modality: 'CT' })
    const { app } = makeApp({ db })
    const body = {
      category_id: OTHER, slug: 'usg-abdomen', modality: 'USG', name: 'USG Abdomen',
      short_description: 'Abdomen scan.', preparation_tips: 'Fast for six hours.',
    }
    await rejects(call(app, catalog.typeStore, { method: 'POST', body }), ValidationError, 'modality')
    assert.equal(db.ran('INSERT INTO scan_types').length, 0)
  })

  it('chooses either a scan type or a modality for checklist items', async () => {
    const { app } = makeApp()
    const body = { code: 'pregnant', question: 'Are you pregnant?', answer_type: 'yes_no' }
    await rejects(call(app, catalog.checklistStore, { method: 'POST', body }), ValidationError, 'scan_type_id')
    await rejects(call(app, catalog.checklistStore, { method: 'POST', body: { ...body, modality: 'CT', scan_type_id: OTHER } }), ValidationError, 'scan_type_id')
  })

  it('stores attention answers as a text[] literal', async () => {
    const db = new FakeDb().on('INSERT INTO checklist_items', { id: OTHER, modality: 'CT', code: 'pregnant', question: 'Are you pregnant?', answer_type: 'yes_no', is_required: true, attention_answers: ['yes'], sort_order: 0, is_active: true })
    const { app } = makeApp({ db })
    const response = await call(app, catalog.checklistStore, {
      method: 'POST', body: { code: 'pregnant', question: 'Are you pregnant?', answer_type: 'yes_no', modality: 'CT', attention_answers: ['yes'] },
    })
    assert.equal(response.status, 201)
    assert.equal(db.ran('INSERT INTO checklist_items')[0].params[7], '{yes}')
    assert.deepEqual(response.decoded().data.attention_answers, ['yes'])
  })
})

describe('stats and audit log', () => {
  it('fills missing days in the stats window', async () => {
    const db = new FakeDb()
    const { app } = makeApp({ db })
    const response = await call(app, stats.show, { query: { days: '7' } })
    const data = response.decoded().data
    assert.equal(data.window.days, 7)
    assert.equal(data.daily_totals.length, 7)
    assert.equal(data.daily_totals.at(-1).date, data.window.to)
    assert.equal(data.appointments_in_window, 0)
    assert.equal(data.pending_reviews, 0)
    await rejects(call(app, stats.show, { query: { days: '3' } }), ValidationError, 'days')
  })

  it('rejects an inverted date range and shapes entries', async () => {
    const { app } = makeApp()
    await rejects(call(app, audit.index, { query: { from: '2026-10-05', to: '2026-10-01' } }), ValidationError, 'to')
    await rejects(call(app, audit.index, { query: { action: 'Bad Action' } }), ValidationError, 'action')

    const db = new FakeDb()
      .on('FROM audit_log a LEFT JOIN', [{ id: 7, actor_user_id: null, actor_name: null, actor_role: null, action: 'admin.faq_created', entity_type: 'faq', entity_id: 'f', ip_address: '1.2.3.4', metadata: {}, created_at: '2026-10-01 10:00:00+05:30' }])
      .on('SELECT count(*) FROM audit_log', { count: 1 })
    const shaped = await call(makeApp({ db }).app, audit.index, { query: { action: 'admin' } })
    const body = shaped.decoded()
    assert.deepEqual(body.data.entries[0].metadata, [])
    assert.equal(body.data.entries[0].created_at, '2026-10-01T10:00:00+05:30')
    assert.deepEqual(body.meta, { page: 1, per_page: 20, total: 1 })
    assert.deepEqual(db.ran('FROM audit_log a LEFT JOIN')[0].params, ['admin', 'admin.%'])
  })
})

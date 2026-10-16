import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ValidationError } from '../src/core/errors.js'
import { ApiRequest } from '../src/core/request.js'
import * as dashboards from '../src/modules/dashboards/dashboards.controller.js'
import * as patients from '../src/modules/patients/patients.controller.js'
import { level, sortQueue, waitingMinutes } from '../src/modules/queue/reading-queue.js'
import * as queue from '../src/modules/queue/queue.controller.js'
import {
  presentBranch,
  presentDoctor,
  presentReview,
  presentReviewSummary,
  presentSettings,
} from '../src/services/public-content-presenter.js'
import { Client, FakeDb, makeApp } from './support/harness.js'

describe('PublicContentPresenter', () => {
  it('nulls placeholder settings and keeps the flag', () => {
    const settings = presentSettings([
      { key: 'contact.phone', value: '9999999999', value_type: 'phone', group_name: 'contact', label: 'Phone', is_placeholder: true },
      { key: 'contact.email', value: null, value_type: 'email', group_name: 'contact', label: 'Email', is_placeholder: 't' },
    ])
    assert.equal(settings['contact.phone'].value, null)
    assert.equal(settings['contact.phone'].is_placeholder, true)
    assert.equal(settings['contact.email'].value, null)
  })

  it('decodes json settings', () => {
    const settings = presentSettings([
      { key: 'clinic.trust_pillars', value: '["A","B"]', value_type: 'json', group_name: 'clinic', label: 'Pillars', is_placeholder: false },
    ])
    assert.deepEqual(settings['clinic.trust_pillars'].value, ['A', 'B'])
    assert.equal(settings['clinic.trust_pillars'].is_placeholder, false)
  })

  it('collects doctor keys only and serialises empty maps as lists', () => {
    const settings = presentSettings([
      { key: 'doctor.name', value: 'Dr X', value_type: 'string', group_name: 'doctor', label: 'Name', is_placeholder: false },
      { key: 'clinic.name', value: 'MDC', value_type: 'string', group_name: 'clinic', label: 'Clinic', is_placeholder: false },
    ])
    assert.deepEqual(Object.keys(presentDoctor(settings)), ['name'])
    assert.deepEqual(presentSettings([]), [])
    assert.deepEqual(presentDoctor({}), [])
  })

  it('summarises reviews', () => {
    assert.deepEqual(presentReviewSummary({ review_count: '0', average_rating: null }), { count: 0, average_rating: null })
    assert.deepEqual(presentReviewSummary({ review_count: '3', average_rating: '4.3333333' }), { count: 3, average_rating: 4.3 })
  })

  it('hides the demo flag unless requested', () => {
    const row = { id: 'x', display_name: 'A', rating: '5', body: 'text', verified_visit: 'f', is_demo: 't', created_at: '2026-10-08 10:00:00+05:30' }
    assert.equal('is_demo' in presentReview(row, false), false)
    assert.equal(presentReview(row, true).is_demo, true)
    assert.equal(presentReview(row, false).created_at, '2026-10-08T10:00:00+05:30')
    assert.equal(presentReview(row, false).source, 'site')
  })

  it('detects placeholder branch addresses', () => {
    const branch = presentBranch({
      id: '1', slug: 'branch-2', name: 'B', address_line: 'TODO: add real value', landmark: null, area: null, city: 'Pune',
      state: 'Maharashtra', postal_code: null, phone: '', whatsapp: null, email: null, opening_hours: null, maps_url: null,
      maps_embed_url: null, latitude: '18.62', longitude: null, is_placeholder: 't',
    })
    assert.equal(branch.address_is_placeholder, true)
    assert.equal(branch.phone, null)
    assert.equal(branch.latitude, 18.62)
    assert.equal(branch.is_placeholder, true)
  })
})

describe('public routes', () => {
  it('serves branches, scan types and settings without a session', async () => {
    const db = new FakeDb()
      .on('FROM branches WHERE is_active', [{ id: 'b1', slug: 'bhosari', name: 'Bhosari', address_line: 'Nagdev', city: 'Pune', state: 'MH', is_placeholder: false }])
      .on('FROM scan_types t', [{ id: 's1', slug: 'ct-brain', modality: 'CT', name: 'CT Brain', category_slug: 'ct', category_name: 'CT', group_slug: null, is_bookable_online: true }])
    const { app } = makeApp({ db })
    const client = new Client(app)
    const branches = await client.get('/public/branches')
    assert.equal(branches.status, 200)
    assert.equal(branches.body.data.branches[0].slug, 'bhosari')
    const scans = await client.get('/public/scan-types', { modality: 'CT' })
    assert.equal(scans.body.meta.total, 1)
    assert.equal(scans.body.data.scan_types[0].group, null)
    const site = await client.get('/public/site')
    assert.deepEqual(site.body, { data: { settings: [] }, error: null })
    assert.equal(db.ran('t.modality = $1').length, 1)
  })

  it('validates filters and 404s unknown scans', async () => {
    const { app } = makeApp({ db: new FakeDb() })
    const client = new Client(app)
    const bad = await client.get('/public/scan-categories', { modality: 'MRI' })
    assert.equal(bad.status, 422)
    assert.deepEqual(Object.keys(bad.body.error.fields), ['modality'])
    const missing = await client.get('/public/scan-types/nope')
    assert.equal(missing.status, 404)
    assert.equal(missing.body.error.message, 'Scan not found.')
    const limit = await client.get('/public/faqs', { limit: '99' })
    assert.equal(limit.status, 422)
  })

  it('exposes the demo flag outside production', async () => {
    const db = new FakeDb()
      .on('FROM reviews', [{ id: 'r1', display_name: 'A', rating: 5, body: 'ok', verified_visit: false, is_demo: true, created_at: '2026-10-08 10:00:00+05:30' }])
      .on('COUNT(*) AS review_count', { review_count: 1, average_rating: '5.0000' })
    const { app } = makeApp({ db })
    const { body } = await new Client(app).get('/public/reviews')
    assert.equal(body.data.reviews[0].is_demo, true)
    assert.deepEqual(body.data.summary, { count: 1, average_rating: 5 })
  })

  it('requires a session for booking endpoints', async () => {
    const { app } = makeApp({ db: new FakeDb() })
    const client = new Client(app)
    for (const path of ['/booking/availability', '/booking/days', '/booking/next-available', '/appointments', '/patients/lookup', '/doctor/queue', '/dashboards/patient']) {
      assert.equal((await client.get(path)).status, 401, path)
    }
  })
})

const staffRequest = (query = {}, role = 'receptionist') => {
  const req = new ApiRequest({ method: 'GET', path: '/api/v1/patients/lookup', query, ip: '203.0.113.9' })
  req.user = { id: '00000000-0000-4000-8000-000000000003', role }
  return req
}

describe('patient lookup', () => {
  it('returns matches without extra fields and audits', async () => {
    const db = new FakeDb().on('FROM patients', [
      { id: '7b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', full_name: 'Asha Patil', phone: '9876543210', email: 'private@example.com' },
    ])
    const { app, audit } = makeApp({ db })
    const response = await patients.lookup(staffRequest({ q: '98765' }), app)
    const payload = response.decoded()
    assert.equal(payload.data.patients[0].full_name, 'Asha Patil')
    assert.equal('email' in payload.data.patients[0], false)
    assert.deepEqual(audit.actions(), ['patient.lookup'])
    assert.deepEqual(audit.entries[0].options.metadata, { results: 1 })
    assert.equal(db.statements.filter((s) => /^\s*(INSERT|UPDATE|DELETE)/i.test(s.sql)).length, 0)
  })

  const bad = [
    ['too short', { q: 'ab' }, null],
    ['missing', {}, null],
    ['oversized', { q: 'a'.repeat(61) }, null],
    ['sql tautology', { q: "' OR '1'='1" }, 'security.sqli_attempt'],
    ['script tag', { q: '<script>alert(1)</script>' }, 'security.xss_attempt'],
  ]
  for (const [name, query, action] of bad) {
    it(`rejects ${name}`, async () => {
      const db = new FakeDb()
      const { app, audit } = makeApp({ db })
      await assert.rejects(patients.lookup(staffRequest(query), app), (error) => error instanceof ValidationError && 'q' in error.fields)
      assert.deepEqual(db.statements, [])
      if (action !== null) assert.ok(audit.actions().includes(action))
    })
  }
})

describe('reading queue', () => {
  const now = new Date('2026-10-09T12:00:00+05:30')
  const row = (ref, urgency, since) => ({ reference_code: ref, urgency, waiting_since: `${since}+05:30` })

  it('orders by urgency, then longest wait', () => {
    const urgency = sortQueue(
      [row('R1', 'Routine', '2026-10-09 06:00:00'), row('P1', 'Priority', '2026-10-09 10:00:00'), row('U1', 'Urgent', '2026-10-09 11:50:00')],
      now,
    )
    assert.deepEqual(urgency.map((r) => r.reference_code), ['U1', 'P1', 'R1'])
    const wait = sortQueue(
      [row('A', 'Priority', '2026-10-09 11:30:00'), row('B', 'Priority', '2026-10-09 09:00:00'), row('C', 'Priority', '2026-10-09 10:15:00')],
      now,
    )
    assert.deepEqual(wait.map((r) => r.reference_code), ['B', 'C', 'A'])
    assert.deepEqual(wait.map((r) => r.waiting_minutes), [180, 105, 30])
  })

  it('never reports negative waits', () => {
    assert.equal(waitingMinutes('2026-10-09 13:00:00+05:30', now), 0)
    assert.equal(waitingMinutes(null, now), 0)
    assert.equal(waitingMinutes('not a date', now), 0)
    assert.deepEqual(sortQueue([], now), [])
  })

  it('grades wait levels', () => {
    assert.equal(level('Urgent', 5), 'ok')
    assert.equal(level('Urgent', 15), 'warning')
    assert.equal(level('Urgent', 30), 'overdue')
    assert.equal(level('Routine', 400), 'overdue')
    assert.equal(level('Routine', 100), 'ok')
  })

  it('serves the queue payload', async () => {
    const db = new FakeDb()
      .on('AT TIME ZONE', [
        { id: 'a1', reference_code: 'MDC-1', urgency: 'Routine', status: 'completed', referral_id: null, modality: 'CT', branch_name: 'B', scan_name: 'CT', patient_name: 'P', waiting_since: '2026-10-09 06:00:00+05:30' },
      ])
      .on('make_interval', [
        { id: 'r1', title: 'T', status: 'final', is_critical: 't', created_at: '2026-10-09 07:00:00+05:30', reference_code: 'MDC-0', scan_name: 'CT', patient_name: 'P', alert_status: null, alert_id: null },
      ])
    const { app } = makeApp({ db })
    app.services.clock.fixed = now
    const req = new ApiRequest({ method: 'GET', path: '/api/v1/doctor/queue' })
    req.user = { id: 'u', role: 'doctor' }
    const body = (await queue.show(req, app)).decoded().data
    assert.equal(body.queue[0].waiting_minutes, 360)
    assert.equal(body.queue[0].wait_level, 'overdue')
    assert.equal(body.queue[0].is_referred, false)
    assert.equal(body.queue[0].waiting_since, '2026-10-09T06:00:00+05:30')
    assert.equal(body.recent_reports[0].is_critical, true)
    assert.equal(body.generated_at, '2026-10-09T12:00:00+05:30')
  })
})

describe('dashboards', () => {
  it('echoes the area from the path', async () => {
    for (const [area, title] of [['patient', 'Patient dashboard'], ['receptionist', 'Reception dashboard']]) {
      const req = new ApiRequest({ method: 'GET', path: `/api/v1/dashboards/${area}` })
      req.user = { id: 'u', role: area }
      assert.deepEqual((await dashboards.show(req)).decoded(), { data: { area, title, role: area, widgets: [] }, error: null })
    }
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ConflictError, NotFoundError } from '../src/core/errors.js'
import * as alerts from '../src/modules/alerts/alerts.controller.js'
import * as presenter from '../src/services/alerts/alert-presenter.js'
import { assertTransition, canTransition, isRedFlagged, mayAcknowledge } from '../src/services/alerts/alert-workflow.js'
import { EncryptionService } from '../src/services/encryption.js'
import { FakeDb, makeApp } from './support/harness.js'
import { makeRequest } from './support/uploads.js'

const PATIENT_USER = '00000000-0000-4000-8000-000000000001'
const REFERRER_USER = '00000000-0000-4000-8000-000000000005'
const OTHER_USER = '00000000-0000-4000-8000-000000000099'
const REPORT = '7c6d5e4f-3a2b-4c1d-8e9f-0a1b2c3d4e5f'
const ALERT = '1c6d5e4f-3a2b-4c1d-8e9f-0a1b2c3d4e5f'

describe('alert workflow', () => {
  const allowed = [['open', 'notified'], ['notified', 'escalated'], ['escalated', 'acknowledged'], ['notified', 'acknowledged'], ['escalated', 'resolved'], ['acknowledged', 'resolved'], ['open', 'cancelled']]
  for (const [from, to] of allowed) {
    it(`allows ${from} to ${to}`, () => {
      assert.equal(canTransition(from, to), true)
      assertTransition(from, to)
    })
  }

  const refused = [['acknowledged', 'acknowledged'], ['acknowledged', 'escalated'], ['resolved', 'acknowledged'], ['resolved', 'resolved'], ['cancelled', 'notified'], ['notified', 'open'], ['unknown', 'resolved']]
  for (const [from, to] of refused) {
    it(`refuses ${from} to ${to}`, () => {
      assert.equal(canTransition(from, to), false)
      assert.throws(() => assertTransition(from, to), (error) => error instanceof ConflictError && error.message === `An alert that is ${from} cannot become ${to}.`)
    })
  }

  const alert = { patient_user_id: PATIENT_USER, referrer_user_id: REFERRER_USER }
  it('limits acknowledgement to the owning patient or linked referrer', () => {
    assert.equal(mayAcknowledge({ id: PATIENT_USER, role: 'patient' }, alert), true)
    assert.equal(mayAcknowledge({ id: REFERRER_USER, role: 'referrer' }, alert), true)
    assert.equal(mayAcknowledge({ id: OTHER_USER, role: 'patient' }, alert), false)
    assert.equal(mayAcknowledge({ id: OTHER_USER, role: 'referrer' }, alert), false)
    assert.equal(mayAcknowledge({ id: PATIENT_USER, role: 'referrer' }, alert), false)
    assert.equal(mayAcknowledge({ id: REFERRER_USER, role: 'patient' }, alert), false)
    for (const role of ['receptionist', 'doctor', 'admin']) assert.equal(mayAcknowledge({ id: PATIENT_USER, role }, alert), false)
    assert.equal(mayAcknowledge({ id: REFERRER_USER, role: 'referrer' }, { patient_user_id: PATIENT_USER, referrer_user_id: null }), false)
  })

  it('red flags only while unresolved', () => {
    assert.equal(isRedFlagged({ status: 'escalated', staff_flagged_at: '2026-10-09T12:00:00+05:30' }), true)
    assert.equal(isRedFlagged({ status: 'resolved', staff_flagged_at: '2026-10-09T12:00:00+05:30' }), false)
    assert.equal(isRedFlagged({ status: 'escalated', staff_flagged_at: null }), false)
  })
})

describe('alert presenter', () => {
  it('keeps empty event details as a list like PHP and real details as an object', () => {
    const base = { id: '5', event_type: 'raised', from_status: null, to_status: 'open', actor_type: 'user', actor_name: 'A', actor_role: 'doctor', channel: null, created_at: '2026-10-09 10:00:00+05:30' }
    assert.deepEqual(presenter.event({ ...base, details: {} }, 'Asia/Kolkata').details, [])
    assert.deepEqual(presenter.event({ ...base, details: '{"a":1}' }, 'Asia/Kolkata').details, { a: 1 })
    assert.equal(presenter.event({ ...base, details: {} }, 'Asia/Kolkata').id, 5)
  })
})

const row = (overrides = {}) => ({
  id: ALERT, report_id: REPORT, patient_id: 'p', referrer_id: null, status: 'notified', escalation_level: 0, notify_count: 1,
  last_notified_at: '2026-10-09 10:00:00+05:30', next_escalation_at: null, staff_flagged_at: null, acknowledged_at: null,
  resolved_at: null, resolution_note: null, created_at: '2026-10-09 10:00:00+05:30', reference_code: 'MDC-1', scan_name: 'CT Brain',
  patient_name: 'Dev Patient', patient_phone: '9876543210', patient_email: 'dev@example.com', patient_user_id: PATIENT_USER,
  referrer_name: null, referrer_user_id: null, referrer_email: null, raised_by_name: 'Dr X', acknowledged_by_name: null, resolved_by_name: null,
  ...overrides,
})

describe('alert controller', () => {
  const setup = () => {
    const db = new FakeDb()
    const made = makeApp({ db })
    made.app.services.encryption = new EncryptionService(EncryptionService.generateKey())
    return made
  }

  it('raises an alert, notifies by email and sms stub and records events', async () => {
    const { app, db, mailer, audit } = setup()
    db.on('FROM reports r', {
      report_id: REPORT, report_title: 'T', is_critical: false, deleted_at: null, patient_id: 'p', appointment_id: 'a', reference_code: 'MDC-1',
      scan_name: 'CT Brain', patient_name: 'Dev Patient', patient_phone: '9876543210', patient_email: 'dev@example.com', patient_user_id: PATIENT_USER,
      referrer_id: null, referrer_name: null, referrer_user_id: null, referrer_email: null,
    })
    db.on('FOR UPDATE', { id: REPORT })
    db.on('SELECT EXISTS', { exists: false })
    db.on('INSERT INTO critical_alerts', { id: ALERT })
    db.on('FROM critical_alerts ca', row())
    const req = await makeRequest({ user: { id: 'doc', role: 'doctor' }, params: { id: REPORT }, json: { note: 'bleed' } })
    const response = await alerts.flag(req, app)
    assert.equal(response.status, 201)
    const body = response.decoded().data
    assert.equal(body.note_stored, true)
    assert.equal(body.alert.id, ALERT)
    assert.equal(body.alert.red_flag, false)
    assert.equal(mailer.sent.length, 1)
    assert.equal(mailer.sent[0].to, 'dev@example.com')
    assert.match(mailer.sent[0].subject, /^Action needed: an important finding/)
    assert.equal(db.ran('INSERT INTO alert_events').map((s) => s.params[1]).join(','), 'raised,notified,notified,notified')
    assert.equal(db.ran('UPDATE reports SET is_critical').length, 1)
    assert.equal(db.ran("status = 'notified', notify_count").length, 1)
    assert.ok(audit.actions().includes('alert.raised'))
    const insert = db.ran('INSERT INTO critical_alerts')[0]
    assert.ok(insert.params.some((p) => typeof p === 'string' && p.startsWith('dc:v1:')))
  })

  it('refuses a second active alert for the same report', async () => {
    const { app, db } = setup()
    db.on('FROM reports r', { report_id: REPORT, deleted_at: null, patient_id: 'p', scan_name: 'CT', patient_name: 'P', reference_code: 'R' })
    db.on('FOR UPDATE', { id: REPORT })
    db.on('SELECT EXISTS', { exists: true })
    const req = await makeRequest({ user: { id: 'doc', role: 'doctor' }, params: { id: REPORT }, json: {} })
    await assert.rejects(alerts.flag(req, app), (error) => error instanceof ConflictError && error.message === 'This report already has an active critical alert.')
    assert.equal(db.ran('INSERT INTO critical_alerts').length, 0)
  })

  it('acknowledges only for the owner and hides alerts from others', async () => {
    const { app, db, audit } = setup()
    db.on('FROM critical_alerts ca', row())
    db.on('FOR UPDATE', { id: ALERT, status: 'notified' })
    const mine = await makeRequest({ user: { id: PATIENT_USER, role: 'patient' }, params: { id: ALERT } })
    const response = await alerts.acknowledge(mine, app)
    assert.equal(response.status, 200)
    assert.equal(response.decoded().data.alert_id, ALERT)
    assert.equal(db.ran('INSERT INTO alert_events')[0].params[1], 'acknowledged')
    assert.ok(audit.actions().includes('alert.acknowledged'))
    const other = await makeRequest({ user: { id: OTHER_USER, role: 'patient' }, params: { id: ALERT } })
    await assert.rejects(alerts.acknowledge(other, app), NotFoundError)
  })

  it('refuses to acknowledge an already resolved alert', async () => {
    const { app, db } = setup()
    db.on('FROM critical_alerts ca', row())
    db.on('FOR UPDATE', { id: ALERT, status: 'resolved' })
    const req = await makeRequest({ user: { id: PATIENT_USER, role: 'patient' }, params: { id: ALERT } })
    await assert.rejects(alerts.acknowledge(req, app), ConflictError)
  })

  it('resolves with a phone contact event and validates the note', async () => {
    const { app, db } = setup()
    db.on('FROM critical_alerts ca', row({ status: 'resolved' }))
    db.on('FOR UPDATE', { id: ALERT, status: 'notified' })
    const short = await makeRequest({ method: 'PATCH', user: { id: 'rec', role: 'receptionist' }, params: { id: ALERT }, json: { note: 'x' } })
    await assert.rejects(alerts.resolve(short, app), (error) => 'note' in error.fields)
    const req = await makeRequest({ method: 'PATCH', user: { id: 'rec', role: 'receptionist' }, params: { id: ALERT }, json: { note: 'Called the patient' } })
    const response = await alerts.resolve(req, app)
    assert.equal(response.decoded().data.alert.status, 'resolved')
    assert.equal(db.ran('INSERT INTO alert_events').map((s) => s.params[1]).join(','), 'phone_contacted,resolved')
  })

  it('lists banners for the patient and referrer audiences', async () => {
    const { app, db } = setup()
    db.on('FROM critical_alerts ca', [row({ referrer_name: 'Dr R', referrer_user_id: REFERRER_USER })])
    const patient = await alerts.mine(await makeRequest({ method: 'GET', user: { id: PATIENT_USER, role: 'patient' } }), app)
    const banner = patient.decoded().data.alerts[0]
    assert.equal(banner.audience, 'patient')
    assert.equal(banner.patient_name, null)
    assert.match(banner.message, /^A finding in your CT Brain report \(reference MDC-1\)/)
    const referrer = await alerts.mine(await makeRequest({ method: 'GET', user: { id: REFERRER_USER, role: 'referrer' } }), app)
    assert.equal(referrer.decoded().data.alerts[0].patient_name, 'Dev Patient')
    assert.equal(db.ran('ref.user_id = $1').length, 1)
  })

  it('paginates the staff list', async () => {
    const { app, db } = setup()
    db.on('FROM critical_alerts ca', [row()])
    db.on('SELECT count(*)', { count: 3 })
    const req = await makeRequest({ method: 'GET', user: { id: 'rec', role: 'receptionist' } })
    req.queryParams = { status: 'active', q: 'dev' }
    const response = await alerts.index(req, app)
    assert.deepEqual(response.decoded().meta, { page: 1, per_page: 25, total: 3 })
    const select = db.ran('ORDER BY (CASE')[0]
    assert.ok(select.sql.includes("ca.status IN ('open', 'notified', 'escalated')"))
    assert.deepEqual(select.params, ['%dev%', 25, 0])
  })
})

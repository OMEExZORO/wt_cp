import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { NotFoundError, SlotFullError, ValidationError } from '../src/core/errors.js'
import { ApiRequest } from '../src/core/request.js'
import * as controller from '../src/modules/appointments/appointments.controller.js'
import { FakeDb, makeApp } from './support/harness.js'

const SCAN = '0b6f4a52-6c1e-4d55-9a44-9d3f3c2b1a10'
const SLOT = '5d0a8f3e-1b2c-4d3e-8f4a-5b6c7d8e9f00'
const OTHER_SLOT = '6e1b9a4f-2c3d-4e4f-9a5b-6c7d8e9f0a11'
const ALLERGY = '11111111-1111-4111-8111-111111111111'
const PATIENT_USER = '00000000-0000-4000-8000-000000000004'
const OTHER_USER = '00000000-0000-4000-8000-000000000099'
const APPOINTMENT = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'
const PATIENT_ID = '7b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
const FIXED_NOW = new Date('2026-10-08T10:00:00+05:30')

const slotRow = (overrides = {}) => ({
  id: SLOT,
  branch_id: 'b1',
  modality: 'CT',
  slot_date: '2026-10-09',
  start_time: '09:00:00',
  end_time: '09:30:00',
  capacity: 1,
  booked_count: 0,
  is_blocked: false,
  branch_name: 'MDC Bhosari',
  branch_slug: 'bhosari',
  branch_is_active: true,
  ...overrides,
})

const detailRow = (overrides = {}) => ({
  id: APPOINTMENT,
  reference_code: 'MDC-261008-ABCDE',
  patient_id: PATIENT_ID,
  slot_id: SLOT,
  branch_id: 'b1',
  scan_type_id: SCAN,
  referral_id: null,
  booked_by_user_id: PATIENT_USER,
  status: 'confirmed',
  urgency: 'Routine',
  patient_notes: 'First visit.',
  checked_in_at: null,
  completed_at: null,
  cancelled_at: null,
  cancellation_reason: null,
  calendar_sequence: 0,
  rescheduled_at: null,
  created_at: '2026-10-08 10:00:00.123456+05:30',
  slot_date: '2026-10-09',
  start_time: '09:00:00',
  end_time: '09:30:00',
  modality: 'CT',
  branch_name: 'MDC Bhosari',
  branch_slug: 'bhosari',
  branch_address_line: 'Nagdev Tower',
  branch_postal_code: '411039',
  branch_phone: '020 1234',
  branch_maps_url: null,
  scan_name: 'CT Brain',
  scan_slug: 'ct-brain',
  preparation_tips: 'Remove metal items.',
  patient_name: 'Dev Patient',
  patient_phone: '9000000004',
  patient_user_id: PATIENT_USER,
  patient_email: 'patient@diagnocare.test',
  booked_by_role: 'patient',
  attention_count: 0,
  ...overrides,
})

const setup = (configure = () => {}) => {
  const db = new FakeDb()
    .on('FROM scan_types t JOIN scan_categories', {
      id: SCAN, slug: 'ct-brain', modality: 'CT', name: 'CT Brain', preparation_tips: 'Remove metal items.',
      duration_minutes: 20, is_bookable_online: true,
    })
    .on('FROM checklist_items', {
      id: ALLERGY, scan_type_id: null, modality: 'CT', code: 'ct_contrast_allergy', question: 'Contrast allergy?',
      help_text: null, answer_type: 'yes_no_unsure', is_required: true, attention_answers: ['yes', 'unsure'], sort_order: 1,
    })
  configure(db)
  const harness = makeApp({ db })
  harness.app.services.clock.fixed = FIXED_NOW
  return harness
}

const request = (method, path, body = {}, { userId = PATIENT_USER, role = 'patient', params = {} } = {}) => {
  const req = new ApiRequest({
    method,
    path,
    headers: { 'content-type': 'application/json' },
    rawBody: Buffer.from(JSON.stringify(body)),
    ip: '203.0.113.9',
  })
  req.user = {
    id: userId, role, email: 'patient@diagnocare.test', full_name: 'Dev Patient', phone: '9000000004', email_verified_at: '2026-10-01',
  }
  req.routeParams = params
  return req
}

const validBody = (overrides = {}) => ({
  scan_type_id: SCAN,
  slot_id: SLOT,
  consent: true,
  patient_notes: 'First visit.',
  answers: { [ALLERGY]: 'no' },
  ...overrides,
})

const writes = (db) => db.statements.filter((s) => /^\s*(INSERT|UPDATE|DELETE|BEGIN)\b/i.test(s.sql))

describe('POST /appointments validation', () => {
  const cases = [
    ['tautology in notes', { patient_notes: "' OR '1'='1" }, 'patient_notes', 'security.sqli_attempt'],
    ['drop table in notes', { patient_notes: "'; DROP TABLE users;--" }, 'patient_notes', 'security.sqli_attempt'],
    ['script tag in notes', { patient_notes: '<script>alert(1)</script>' }, 'patient_notes', 'security.xss_attempt'],
    ['union select in slot id', { slot_id: '1 UNION SELECT password_hash FROM users' }, 'slot_id', 'security.sqli_attempt'],
    ['script in checklist answer', { answers: { [ALLERGY]: '<img src=x onerror=alert(1)>' } }, `answers.${ALLERGY}`, 'security.xss_attempt'],
    ['oversized notes', { patient_notes: 'a'.repeat(1001) }, 'patient_notes', null],
    ['missing consent', { consent: false }, 'consent', null],
    ['unknown checklist option', { answers: { [ALLERGY]: 'maybe' } }, `answers.${ALLERGY}`, null],
    ['answers sent as a list', { answers: ['no'] }, 'answers', null],
  ]
  for (const [name, overrides, field, auditAction] of cases) {
    it(`rejects ${name} and writes nothing`, async () => {
      const { app, db, audit, mailer } = setup()
      await assert.rejects(controller.store(request('POST', '/api/v1/appointments', validBody(overrides)), app), (error) => {
        assert.ok(error instanceof ValidationError)
        assert.ok(field in error.fields, `expected ${field} in ${JSON.stringify(error.fields)}`)
        return true
      })
      assert.deepEqual(writes(db), [])
      assert.equal(mailer.sent.length, 0)
      if (auditAction !== null) assert.ok(audit.actions().includes(auditAction))
    })
  }

  it('asks staff for a patient when none is given', async () => {
    const { app } = setup()
    const req = request('POST', '/api/v1/appointments', validBody(), { role: 'receptionist' })
    await assert.rejects(controller.store(req, app), (error) => {
      assert.equal(error.fields.patient_full_name, "Enter the patient's name and mobile number, or choose an existing patient.")
      assert.equal(error.fields.patient_phone, "Enter the patient's mobile number.")
      return true
    })
  })
})

describe('POST /appointments booking', () => {
  const bookingDb = (db, slot = slotRow()) => {
    db.on('FROM appointments a', detailRow())
      .on('FOR UPDATE OF s', slot)
      .on('SELECT * FROM patients WHERE user_id', { id: PATIENT_ID, user_id: PATIENT_USER })
      .on('SELECT EXISTS (SELECT 1 FROM appointments WHERE patient_id', { exists: false })
      .on('SELECT EXISTS (SELECT 1 FROM appointments WHERE reference_code', { exists: false })
      .on('INSERT INTO appointments', { id: APPOINTMENT })
  }

  it('books inside a transaction, increments the slot, audits and emails', async () => {
    const { app, db, audit, mailer } = setup((d) => bookingDb(d))
    const response = await controller.store(request('POST', '/api/v1/appointments', validBody()), app)
    assert.equal(response.status, 201)
    const body = response.decoded()
    assert.equal(body.data.email_sent, true)
    assert.equal(body.data.appointment.id, APPOINTMENT)
    assert.equal(body.data.appointment.starts_at, '2026-10-09T09:00:00+05:30')
    assert.equal(body.data.appointment.can_cancel, true)
    assert.equal(body.data.appointment.patient.phone, undefined)
    assert.equal(db.ran('FOR UPDATE OF s').length, 1)
    assert.equal(db.ran('UPDATE slots SET booked_count = booked_count + 1').length, 1)
    assert.equal(db.ran('INSERT INTO appointment_checklist_answers')[0].params[3], false)
    assert.ok(db.statements.map((s) => s.sql).indexOf('BEGIN') < db.statements.findIndex((s) => s.sql.includes('FOR UPDATE OF s')))
    assert.deepEqual(audit.actions(), ['booking.created'])
    assert.equal(mailer.sent.length, 1)
    assert.equal(mailer.sent[0].to, 'patient@diagnocare.test')
    assert.match(mailer.sent[0].subject, /^Appointment confirmed: CT Brain \(MDC-261008-ABCDE\)$/)
    assert.equal(mailer.sent[0].attachments[0].name, 'appointment-mdc-261008-abcde.ics')
    assert.match(mailer.sent[0].text, /When: Friday 9 October 2026, 9:00 AM/)
  })

  it('returns 409 with a SLOT_FULL suggestion when the slot is full', async () => {
    const { app, db, audit } = setup((d) => bookingDb(d, slotRow({ booked_count: 1 })))
    await assert.rejects(controller.store(request('POST', '/api/v1/appointments', validBody()), app), (error) => {
      assert.ok(error instanceof SlotFullError)
      assert.equal(error.status, 409)
      assert.equal(error.extra.reason, 'SLOT_FULL')
      assert.equal(error.extra.suggestion, null)
      assert.deepEqual(error.fields, { slot_id: error.message })
      return true
    })
    assert.equal(db.ran('INSERT INTO appointments').length, 0)
    assert.deepEqual(audit.actions(), ['booking.slot_full'])
  })

  it('suggests the next slot at another branch when full', async () => {
    const next = slotRow({ id: OTHER_SLOT, branch_id: 'b2', branch_name: 'MDC Pimpri', branch_slug: 'pimpri', slot_date: '2026-10-09', start_time: '10:00:00', end_time: '10:30:00' })
    const { app } = setup((d) => {
      bookingDb(d, slotRow({ booked_count: 1 }))
      d.on('ORDER BY s.slot_date, s.start_time, b.sort_order', next)
    })
    await assert.rejects(controller.store(request('POST', '/api/v1/appointments', validBody()), app), (error) => {
      assert.equal(error.extra.suggestion.kind, 'other_branch')
      assert.equal(error.extra.suggestion.branch.slug, 'pimpri')
      assert.equal(error.extra.suggestion.slot.id, OTHER_SLOT)
      return true
    })
  })

  it('maps the booked_count check constraint to SLOT_FULL', async () => {
    const { app, db } = setup((d) => bookingDb(d))
    db.on('UPDATE slots SET booked_count = booked_count + 1', () => {
      throw Object.assign(new Error('violates check constraint "slots_booked_count_check"'), { code: '23514' })
    })
    await assert.rejects(controller.store(request('POST', '/api/v1/appointments', validBody()), app), SlotFullError)
  })

  it('maps a unique violation to a duplicate booking conflict', async () => {
    const { app, db } = setup((d) => bookingDb(d))
    db.on('INSERT INTO appointments', () => {
      throw Object.assign(new Error('duplicate key'), { code: '23505' })
    })
    await assert.rejects(controller.store(request('POST', '/api/v1/appointments', validBody()), app), (error) => {
      assert.equal(error.status, 409)
      assert.equal(error.message, 'You already have a booking in this time slot.')
      assert.deepEqual(error.fields, { slot_id: 'You already have a booking in this time slot.' })
      return true
    })
  })

  it('flags attention answers', async () => {
    const { app, audit } = setup((d) => bookingDb(d))
    await controller.store(request('POST', '/api/v1/appointments', validBody({ answers: { [ALLERGY]: 'yes' } })), app)
    assert.deepEqual(audit.actions(), ['booking.created', 'booking.attention_flagged'])
    assert.deepEqual(audit.entries[0].options.metadata.attention_items, ['ct_contrast_allergy'])
  })
})

describe('appointment access', () => {
  it('does not show another patient their appointment', async () => {
    const { app } = setup((d) => d.on('FROM appointments a', detailRow({ patient_user_id: OTHER_USER })))
    await assert.rejects(
      controller.show(request('GET', `/api/v1/appointments/${APPOINTMENT}`, {}, { params: { id: APPOINTMENT } }), app),
      NotFoundError,
    )
  })

  it('does not let a patient cancel another patient appointment', async () => {
    const { app, db } = setup((d) => d.on('FROM appointments a', detailRow({ patient_user_id: OTHER_USER })))
    await assert.rejects(
      controller.cancel(request('PATCH', `/api/v1/appointments/${APPOINTMENT}/cancel`, {}, { params: { id: APPOINTMENT } }), app),
      NotFoundError,
    )
    assert.deepEqual(writes(db), [])
  })

  it('does not give a referrer the calendar file', async () => {
    const { app } = setup((d) => d.on('FROM appointments a', detailRow()))
    await assert.rejects(
      controller.ics(request('GET', `/api/v1/appointments/${APPOINTMENT}/ics`, {}, { userId: OTHER_USER, role: 'referrer', params: { id: APPOINTMENT } }), app),
      NotFoundError,
    )
  })

  it('serves the calendar file to the owner', async () => {
    const { app } = setup((d) => d.on('FROM appointments a', detailRow()))
    const response = await controller.ics(request('GET', `/api/v1/appointments/${APPOINTMENT}/ics`, {}, { params: { id: APPOINTMENT } }), app)
    assert.equal(response.status, 200)
    assert.equal(response.header('Content-Type'), 'text/calendar; charset=utf-8')
    assert.equal(response.header('Content-Disposition'), 'attachment; filename="appointment-mdc-261008-abcde.ics"')
    assert.ok(response.body.toString('utf8').includes(`UID:${APPOINTMENT}@localhost\r\n`))
  })
})

describe('cancel, reschedule and status', () => {
  const lockRow = (overrides = {}) => ({ ...detailRow(), ...overrides })

  it('cancels, releases the slot and emails', async () => {
    const { app, db, audit, mailer } = setup((d) =>
      d.on('FROM appointments a', detailRow({ status: 'cancelled', cancellation_reason: 'Changed plans' }))
        .on('FOR UPDATE OF a', lockRow())
        .on('FOR UPDATE OF s', slotRow({ booked_count: 1 })),
    )
    const response = await controller.cancel(
      request('PATCH', `/api/v1/appointments/${APPOINTMENT}/cancel`, { reason: 'Changed plans' }, { params: { id: APPOINTMENT } }),
      app,
    )
    assert.equal(response.status, 200)
    assert.equal(db.ran('GREATEST(booked_count - 1, 0)').length, 1)
    assert.deepEqual(db.ran("SET status = 'cancelled'")[0].params, ['Changed plans', APPOINTMENT])
    assert.deepEqual(audit.actions(), ['booking.cancelled'])
    assert.equal(mailer.sent[0].attachments[0].type, 'text/calendar; charset=utf-8; method=CANCEL')
    assert.equal(response.decoded().data.appointment.calendar.google_url, null)
  })

  it('refuses to cancel an appointment that already started when asked by a patient', async () => {
    const { app } = setup((d) =>
      d.on('FROM appointments a', detailRow()).on('FOR UPDATE OF a', lockRow({ slot_date: '2026-10-08', start_time: '09:00:00' })),
    )
    await assert.rejects(
      controller.cancel(request('PATCH', `/api/v1/appointments/${APPOINTMENT}/cancel`, {}, { params: { id: APPOINTMENT } }), app),
      (error) => {
        assert.equal(error.status, 409)
        assert.equal(error.message, 'This appointment has already started and cannot be cancelled online. Please contact the centre.')
        return true
      },
    )
  })

  it('reschedules, moves counts and emails the previous time', async () => {
    const { app, db, audit, mailer } = setup((d) =>
      d.on('FROM appointments a', detailRow({ slot_id: OTHER_SLOT, start_time: '10:00:00', end_time: '10:30:00' }))
        .on('FOR UPDATE OF a', lockRow())
        .on('ORDER BY s.id FOR UPDATE OF s', [slotRow(), slotRow({ id: OTHER_SLOT, start_time: '10:00:00', end_time: '10:30:00' })])
        .on('SELECT EXISTS (SELECT 1 FROM appointments WHERE patient_id', { exists: false }),
    )
    const response = await controller.reschedule(
      request('PATCH', `/api/v1/appointments/${APPOINTMENT}/reschedule`, { slot_id: OTHER_SLOT }, { params: { id: APPOINTMENT } }),
      app,
    )
    assert.equal(response.status, 200)
    assert.equal(db.ran('UPDATE slots SET booked_count = booked_count + 1')[0].params[0], OTHER_SLOT)
    assert.equal(db.ran('GREATEST(booked_count - 1, 0)')[0].params[0], SLOT)
    assert.equal(db.ran('calendar_sequence = calendar_sequence + 1')[0].params[0], OTHER_SLOT)
    assert.deepEqual(audit.actions(), ['booking.rescheduled'])
    assert.deepEqual(audit.entries[0].options.metadata.from, { slot_id: SLOT, branch_id: 'b1', date: '2026-10-09', start_time: '09:00' })
    assert.match(mailer.sent[0].text, /Previous time: Friday 9 October 2026, 9:00 AM/)
  })

  it('rejects rescheduling onto the same slot', async () => {
    const { app } = setup((d) => d.on('FROM appointments a', detailRow()).on('FOR UPDATE OF a', lockRow()))
    await assert.rejects(
      controller.reschedule(request('PATCH', `/api/v1/appointments/${APPOINTMENT}/reschedule`, { slot_id: SLOT }, { params: { id: APPOINTMENT } }), app),
      (error) => error instanceof ValidationError && error.fields.slot_id === 'Choose a different time from your current booking.',
    )
  })

  it('requires a status or urgency on status updates', async () => {
    const { app } = setup()
    await assert.rejects(
      controller.updateStatus(request('PATCH', `/api/v1/appointments/${APPOINTMENT}/status`, {}, { role: 'receptionist', params: { id: APPOINTMENT } }), app),
      (error) => error.fields.status === 'Choose a new status or urgency.',
    )
  })

  it('checks a patient in and audits the change', async () => {
    const { app, db, audit } = setup((d) =>
      d.on('FROM appointments a', detailRow({ status: 'checked_in' }))
        .on('FOR UPDATE OF a', lockRow({ slot_date: '2026-10-08', start_time: '09:00:00' })),
    )
    const response = await controller.updateStatus(
      request('PATCH', `/api/v1/appointments/${APPOINTMENT}/status`, { status: 'checked_in' }, { role: 'receptionist', params: { id: APPOINTMENT } }),
      app,
    )
    assert.equal(response.status, 200)
    assert.match(db.ran('UPDATE appointments SET')[0].sql, /status = \$1, checked_in_at = COALESCE\(checked_in_at, now\(\)\)/)
    assert.deepEqual(audit.entries[0].options.metadata, { reference: 'MDC-261008-ABCDE', from: 'confirmed', to: 'checked_in' })
    assert.equal(response.decoded().data.appointment.patient.phone, '9000000004')
  })
})

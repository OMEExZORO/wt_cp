import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ConflictError, NotFoundError, ValidationError } from '../src/core/errors.js'
import * as reviews from '../src/modules/reviews/reviews.controller.js'
import { assertEligible, defaultDisplayName } from '../src/services/review-policy.js'
import { FakeDb, makeApp } from './support/harness.js'
import { makeRequest } from './support/uploads.js'

const USER = '00000000-0000-4000-8000-000000000004'
const OTHER = '00000000-0000-4000-8000-000000000099'
const APPOINTMENT = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'

const appointment = (status = 'completed', owner = USER) => ({ id: APPOINTMENT, status, patient_id: 'p-1', patient_user_id: owner })

describe('review policy', () => {
  it('accepts a completed own visit', () => assert.doesNotThrow(() => assertEligible(appointment(), USER, false)))
  it('treats unknown and foreign appointments as not found', () => {
    assert.throws(() => assertEligible(null, USER, false), NotFoundError)
    assert.throws(() => assertEligible(appointment('completed', OTHER), USER, false), NotFoundError)
  })
  for (const status of ['pending', 'confirmed', 'checked_in', 'in_progress', 'cancelled', 'no_show']) {
    it(`refuses ${status} visits`, () => {
      assert.throws(() => assertEligible(appointment(status), USER, false), (error) => error instanceof ValidationError && 'appointment_id' in error.fields)
    })
  }
  it('conflicts on a second review', () => assert.throws(() => assertEligible(appointment(), USER, true), ConflictError))
  it('builds default display names', () => {
    assert.equal(defaultDisplayName('Asha Kulkarni'), 'Asha K.')
    assert.equal(defaultDisplayName('Asha Rao Patil'), 'Asha P.')
    assert.equal(defaultDisplayName('Asha'), 'Asha')
    assert.equal(defaultDisplayName('   '), 'Patient')
  })
})

describe('review controller', () => {
  const body = (overrides = {}) => ({ appointment_id: APPOINTMENT, rating: 5, body: 'Friendly staff and a quick scan.', consent: true, ...overrides })
  const post = (json) => makeRequest({ path: '/api/v1/reviews', user: { id: USER, role: 'patient', full_name: 'Dev Patient' }, json })

  const bad = [
    ['rating zero', { rating: 0 }, 'rating'],
    ['rating six', { rating: 6 }, 'rating'],
    ['text too short', { body: 'Nice' }, 'body'],
    ['script in text', { body: '<script>alert(1)</script> padding' }, 'body'],
    ['sql in text', { body: "'; DROP TABLE users;-- padding" }, 'body'],
    ['oversized text', { body: 'a'.repeat(1001) }, 'body'],
    ['no consent', { consent: false }, 'consent'],
    ['bad appointment id', { appointment_id: 'abc' }, 'appointment_id'],
    ['markup in name', { display_name: '<b>Eve</b>' }, 'display_name'],
  ]
  for (const [label, overrides, field] of bad) {
    it(`rejects ${label} without writing`, async () => {
      const { app, db } = makeApp()
      await assert.rejects(reviews.store(await post(body(overrides)), app), (error) => error instanceof ValidationError && field in error.fields)
      assert.equal(db.ran('INSERT').length, 0)
    })
  }

  it('stores an eligible review as pending and verified', async () => {
    const { app, db, audit } = makeApp()
    db.on('FROM appointments a JOIN patients p', appointment())
    db.on('SELECT EXISTS', { exists: false })
    db.on('INSERT INTO reviews', { id: 'r-1', display_name: 'Dev P.', rating: 5, body: 'Friendly staff and a quick scan.', status: 'pending', verified_visit: true, created_at: '2026-10-09 10:00:00+05:30' })
    const response = await reviews.store(await post(body()), app)
    assert.equal(response.status, 201)
    assert.equal(response.decoded().data.status, 'pending')
    assert.equal(response.decoded().data.created_at, '2026-10-09T10:00:00+05:30')
    assert.ok(audit.actions().includes('review.submitted'))
    assert.equal(db.ran('INSERT INTO reviews').length, 1)
    assert.ok(db.ran('INSERT INTO reviews')[0].params.includes('Dev P.'))
  })

  it('maps a unique violation to a conflict', async () => {
    const db = new FakeDb()
    const { app } = makeApp({ db })
    db.on('FROM appointments a JOIN patients p', appointment())
    db.on('SELECT EXISTS', { exists: false })
    db.on('INSERT INTO reviews', () => {
      throw Object.assign(new Error('duplicate'), { code: '23505' })
    })
    await assert.rejects(reviews.store(await post(body()), app), (error) => error instanceof ConflictError && error.message === 'You have already reviewed this visit.')
  })

  it('does not write for an uncompleted visit', async () => {
    const { app, db } = makeApp()
    db.on('FROM appointments a JOIN patients p', appointment('confirmed'))
    db.on('SELECT EXISTS', { exists: false })
    await assert.rejects(reviews.store(await post(body()), app), ValidationError)
    assert.equal(db.ran('INSERT').length, 0)
  })

  it('lists own reviews and eligible appointments', async () => {
    const { app, db } = makeApp()
    db.on('FROM reviews r JOIN patients p', [{ id: 'r', display_name: 'D', rating: '4', body: 'b', status: 'approved', verified_visit: true, created_at: '2026-10-09 10:00:00+05:30' }])
    db.on("a.status = 'completed'", [{ id: 'a', reference_code: 'R', slot_date: '2026-10-09', scan_name: 'CT', branch_name: 'Main', extra: 1 }])
    const response = await reviews.mine(await makeRequest({ method: 'GET', user: { id: USER, role: 'patient' } }), app)
    const data = response.decoded().data
    assert.equal(data.reviews[0].rating, 4)
    assert.deepEqual(data.eligible_appointments, [{ id: 'a', reference_code: 'R', slot_date: '2026-10-09', scan_name: 'CT', branch_name: 'Main' }])
  })
})

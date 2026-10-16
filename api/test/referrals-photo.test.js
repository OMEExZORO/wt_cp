import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { deflateSync } from 'node:zlib'
import { describe, it } from 'node:test'
import { AuthorizationError, NotFoundError, PayloadTooLargeError, ValidationError } from '../src/core/errors.js'
import * as photo from '../src/modules/doctor-photo/doctor-photo.controller.js'
import * as referrals from '../src/modules/referrals/referrals.controller.js'
import { EncryptionService } from '../src/services/encryption.js'
import { FakeDb, makeApp } from './support/harness.js'
import { MemoryStorage, makeRequest } from './support/uploads.js'

const REFERRER_USER = '00000000-0000-4000-8000-000000000005'
const REFERRAL = '2a6d5e4f-3a2b-4c1d-8e9f-0a1b2c3d4e5f'
const SCAN = '3a6d5e4f-3a2b-4c1d-8e9f-0a1b2c3d4e5f'

const setup = (env = {}) => {
  const db = new FakeDb()
  const made = makeApp({ db, env })
  made.crypto = new EncryptionService(EncryptionService.generateKey())
  made.app.services.encryption = made.crypto
  made.app.services.storage = new MemoryStorage()
  return made
}

const referralRow = (crypto, overrides = {}) => ({
  id: REFERRAL, reference_code: 'RF-261009-ABC234', referrer_id: 'rr', patient_id: null, patient_name: 'Asha Rao', patient_phone: '9876543210',
  patient_email: null, scan_type_id: SCAN, preferred_branch_id: null, urgency: 'Routine', status: 'submitted',
  clinical_notes_encrypted: crypto.encryptText('chest pain'), status_changed_at: '2026-10-09 10:00:00+05:30', created_at: '2026-10-09 10:00:00+05:30',
  referrer_user_id: REFERRER_USER, referrer_name: 'Dr R', referrer_clinic: 'Clinic', scan_name: 'CT Chest', scan_modality: 'CT', branch_name: null,
  appointment_id: 'ap', appointment_reference: 'MDC-1', appointment_status: 'confirmed', appointment_date: '2026-10-12', appointment_time: '09:30:00',
  ...overrides,
})

describe('referrals', () => {
  const createBody = { patient_name: 'Asha Rao', patient_phone: '9876543210', scan_type_id: SCAN, clinical_notes: 'chest pain' }

  it('creates a referral with encrypted notes and a RF reference', async () => {
    const { app, db, crypto, audit } = setup()
    db.on('SELECT * FROM referrers WHERE user_id', { id: 'rr' })
    db.on('SELECT * FROM scan_types', { id: SCAN })
    db.on('SELECT EXISTS', { exists: false })
    db.on('INSERT INTO referrals', { id: REFERRAL, reference_code: 'RF-261009-ABC234', urgency: 'Routine' })
    db.on('FROM referrals rf', referralRow(crypto))
    const req = await makeRequest({ path: '/api/v1/referrals', user: { id: REFERRER_USER, role: 'referrer' }, json: createBody })
    const response = await referrals.store(req, app)
    assert.equal(response.status, 201)
    const insert = db.ran('INSERT INTO referrals')[0]
    assert.match(insert.params[0], /^RF-\d{6}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/)
    assert.ok(insert.params.some((p) => typeof p === 'string' && p.startsWith('dc:v1:')))
    assert.ok(audit.actions().includes('referral.created'))
    const referral = response.decoded().data.referral
    assert.equal(referral.clinical_notes, 'chest pain')
    assert.deepEqual(referral.appointment, { id: 'ap', reference_code: 'MDC-1', status: 'confirmed', date: '2026-10-12', time: '09:30' })
    assert.deepEqual(referral.reports, [])
    assert.equal(referral.referrer, undefined)
  })

  it('reports field errors for unknown scan and branch', async () => {
    const { app, db } = setup()
    db.on('SELECT * FROM referrers WHERE user_id', { id: 'rr' })
    const req = await makeRequest({
      path: '/api/v1/referrals',
      user: { id: REFERRER_USER, role: 'referrer' },
      json: { ...createBody, preferred_branch_id: '4a6d5e4f-3a2b-4c1d-8e9f-0a1b2c3d4e5f' },
    })
    const error = await referrals.store(req, app).catch((e) => e)
    assert.ok(error instanceof ValidationError)
    assert.deepEqual(error.fields, { scan_type_id: 'Choose a scan from the list.', preferred_branch_id: 'Choose a branch from the list.' })
    assert.equal(db.ran('INSERT').length, 0)
  })

  it('requires a referrer profile', async () => {
    const { app } = setup()
    const req = await makeRequest({ path: '/api/v1/referrals', user: { id: REFERRER_USER, role: 'referrer' }, json: createBody })
    await assert.rejects(referrals.store(req, app), AuthorizationError)
  })

  it('hides other referrers referrals and shows staff the referrer block', async () => {
    const { app, db, crypto } = setup()
    db.on('FROM referrals rf', referralRow(crypto))
    const other = await makeRequest({ method: 'GET', user: { id: 'someone-else', role: 'referrer' }, params: { id: REFERRAL } })
    await assert.rejects(referrals.show(other, app), NotFoundError)
    const staff = await makeRequest({ method: 'GET', user: { id: 'rec', role: 'receptionist' }, params: { id: REFERRAL } })
    const data = (await referrals.show(staff, app)).decoded().data.referral
    assert.deepEqual(data.referrer, { name: 'Dr R', clinic_name: 'Clinic' })
  })

  it('links an appointment, moves submitted to scheduled and updates in a transaction', async () => {
    const { app, db, crypto } = setup()
    db.on('FROM referrals rf', referralRow(crypto))
    db.on('FROM appointments a WHERE a.id', { id: 'ap', status: 'confirmed', patient_id: 'pt', referral_id: null })
    const req = await makeRequest({ method: 'PATCH', user: { id: 'rec', role: 'receptionist' }, params: { id: REFERRAL }, json: { appointment_id: 'ba6d5e4f-3a2b-4c1d-8e9f-0a1b2c3d4e5f' } })
    const response = await referrals.update(req, app)
    assert.equal(response.status, 200)
    assert.equal(db.ran('UPDATE appointments SET referral_id').length, 1)
    const update = db.ran('UPDATE referrals SET')[0]
    assert.ok(update.sql.includes('patient_id') && update.sql.includes('status'))
    assert.ok(update.params.includes('scheduled'))
    assert.equal(db.ran('BEGIN').length, 1)
  })

  it('refuses an empty update and an appointment linked elsewhere', async () => {
    const { app, db, crypto } = setup()
    db.on('FROM referrals rf', referralRow(crypto))
    const empty = await makeRequest({ method: 'PATCH', user: { id: 'rec', role: 'receptionist' }, params: { id: REFERRAL }, json: {} })
    await assert.rejects(referrals.update(empty, app), (e) => e.fields.status === 'Choose a new status or an appointment to link.')
    db.on('FROM appointments a WHERE a.id', { id: 'ap', status: 'confirmed', patient_id: 'pt', referral_id: 'another' })
    const linked = await makeRequest({ method: 'PATCH', user: { id: 'rec', role: 'receptionist' }, params: { id: REFERRAL }, json: { appointment_id: 'ba6d5e4f-3a2b-4c1d-8e9f-0a1b2c3d4e5f' } })
    await assert.rejects(referrals.update(linked, app), (e) => e.fields.appointment_id === 'This appointment is already linked to another referral.')
  })
})

const crc32 = (buffer) => {
  let crc = -1
  for (const byte of buffer) {
    crc ^= byte
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ -1) >>> 0
}

const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data])
  const out = Buffer.alloc(body.length + 8)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), body.length + 4)
  return out
}

const png = (width, height) => {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 0
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width)])
  const raw = Buffer.concat(Array.from({ length: height }, () => row))
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

describe('doctor photo', () => {
  const admin = { id: 'adm', role: 'admin' }
  const upload = (buffer, name = 'doctor.png') => makeRequest({ path: '/api/v1/admin/doctor/photo', user: admin, fields: {}, file: { field: 'photo', name, buffer } })

  it('stores a valid image, replaces the previous one and serves it publicly', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'dc-photo-'))
    try {
      const { app, db, audit } = setup({ STORAGE_ROOT: root })
      app.config.storagePath = root
      const first = await photo.upload(await upload(png(240, 260)), app)
      assert.match(first.decoded().data.photo_url, /\/api\/v1\/public\/doctor\/photo\?v=\d+$/)
      await photo.upload(await upload(png(300, 300)), app)
      assert.equal((await readdir(path.join(root, 'uploads', 'doctor'))).length, 1)
      assert.equal(db.ran('UPDATE site_settings').length, 2)
      assert.ok(audit.actions().includes('admin.doctor_photo_uploaded'))
      const shown = await photo.show(await makeRequest({ method: 'GET' }), app)
      assert.equal(shown.header('Content-Type'), 'image/png')
      assert.equal(shown.header('Cache-Control'), 'public, max-age=86400')
      assert.equal(shown.header('Cross-Origin-Resource-Policy'), 'cross-origin')
      const removed = await photo.destroy(await makeRequest({ method: 'DELETE', user: admin }), app)
      assert.equal(removed.status, 204)
      assert.equal(db.ran('UPDATE site_settings')[2].params[0], null)
      await assert.rejects(photo.show(await makeRequest({ method: 'GET' }), app), NotFoundError)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects missing, wrong type, tiny and oversized images', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'dc-photo-'))
    try {
      const { app } = setup({ STORAGE_ROOT: root })
      const none = await makeRequest({ user: admin, fields: {} })
      await assert.rejects(photo.upload(none, app), (e) => e.fields.photo === 'Choose an image file to upload.')
      await assert.rejects(photo.upload(await upload(Buffer.from('not an image at all')), app), (e) => e.fields.photo === 'Only JPEG, PNG or WebP images are accepted.')
      await assert.rejects(photo.upload(await upload(png(50, 50)), app), (e) => e.fields.photo === 'The image must be between 200 and 6000 pixels on each side.')
      await assert.rejects(photo.upload(await upload(Buffer.concat([png(240, 240), Buffer.alloc(2 * 1048576)])), app), PayloadTooLargeError)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

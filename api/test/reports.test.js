import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { NotFoundError, PayloadTooLargeError, StorageError, ValidationError } from '../src/core/errors.js'
import * as reports from '../src/modules/reports/reports.controller.js'
import { EncryptionService } from '../src/services/encryption.js'
import { canDelete, canView } from '../src/services/reports/report-access-policy.js'
import { UploadedFileValidator } from '../src/services/reports/uploaded-file-validator.js'
import { LocalStorage } from '../src/services/storage/local-storage.js'
import { SupabaseStorage } from '../src/services/storage/supabase-storage.js'
import { FakeDb, makeApp } from './support/harness.js'
import { MemoryStorage, PDF, makeRequest } from './support/uploads.js'

const APPOINTMENT = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'
const PATIENT = '3f2b1a09-8c7d-4e6f-9a5b-4c3d2e1f0a9b'
const REPORT = '7c6d5e4f-3a2b-4c1d-8e9f-0a1b2c3d4e5f'
const DOCTOR = { id: '00000000-0000-4000-8000-000000000002', role: 'doctor', full_name: 'Dev Doctor' }

const setup = (db = new FakeDb()) => {
  const made = makeApp({ db })
  made.crypto = new EncryptionService(EncryptionService.generateKey())
  made.storage = new MemoryStorage()
  made.app.services.encryption = made.crypto
  made.app.services.storage = made.storage
  db.on('FROM appointments a', { id: APPOINTMENT, patient_id: PATIENT, status: 'confirmed', referral_id: null })
  return made
}

const writes = (db) => db.statements.filter((s) => /^\s*(INSERT|UPDATE|DELETE)/.test(s.sql))

const upload = (name, buffer, fields = {}) =>
  makeRequest({
    user: DOCTOR,
    fields: { appointment_id: APPOINTMENT, title: 'CT Brain report', status: 'final', ...fields },
    file: { name, buffer },
  })

const rejects = async (promise, Type) => {
  try {
    await promise
  } catch (error) {
    assert.ok(error instanceof Type, `expected ${Type.name}, got ${error?.constructor?.name}: ${error?.message}`)
    return error
  }
  assert.fail(`expected ${Type.name}`)
}

describe('report upload validation', () => {
  it('rejects plain text behind a pdf extension and writes nothing', async () => {
    const { app, db, storage } = setup()
    const error = await rejects(reports.store(await upload('scan.pdf', Buffer.from('just some plain text pretending to be a report\n')), app), ValidationError)
    assert.ok('file' in error.fields)
    assert.deepEqual(writes(db), [])
    assert.equal(storage.objects.size, 0)
  })

  it('rejects a php script behind a pdf extension', async () => {
    const { app, db } = setup()
    await rejects(reports.store(await upload('shell.pdf', Buffer.from("<?php system($_GET['c']); ?>")), app), ValidationError)
    assert.deepEqual(writes(db), [])
  })

  it('rejects pdf contents with an image extension', async () => {
    const { app, db } = setup()
    const error = await rejects(reports.store(await upload('scan.png', PDF), app), ValidationError)
    assert.match(error.fields.file, /extension/)
    assert.deepEqual(writes(db), [])
  })

  for (const name of ['report.php.pdf', 'report.phtml.pdf', 'report.exe.pdf', 'report.html.pdf', '..\\..\\report.sh.pdf']) {
    it(`rejects the executable looking name ${name}`, async () => {
      const { app, db } = setup()
      const error = await rejects(reports.store(await upload(name, PDF), app), ValidationError)
      assert.ok('file' in error.fields)
      assert.deepEqual(writes(db), [])
    })
  }

  it('rejects oversize files with 413 and writes nothing', async () => {
    const { app, db, storage } = setup()
    app.services.reportFiles = new UploadedFileValidator(1024)
    const error = await rejects(reports.store(await upload('big.pdf', Buffer.concat([PDF, Buffer.alloc(2048, 65)])), app), PayloadTooLargeError)
    assert.equal(error.status, 413)
    assert.deepEqual(writes(db), [])
    assert.equal(storage.objects.size, 0)
  })

  it('rejects a declared oversize request before reading the body', async () => {
    const { app } = setup()
    const req = await makeRequest({ user: DOCTOR, headers: { 'content-type': 'multipart/form-data', 'content-length': '99999999' } })
    await rejects(reports.store(req, app), PayloadTooLargeError)
  })

  it('requires a file', async () => {
    const { app, db } = setup()
    const req = await makeRequest({ user: DOCTOR, fields: { appointment_id: APPOINTMENT, title: 'CT Brain report' } })
    const error = await rejects(reports.store(req, app), ValidationError)
    assert.equal(error.fields.file, 'Choose a file to upload.')
    assert.deepEqual(writes(db), [])
  })

  const malicious = [
    ['script in title', { title: '<script>alert(1)</script>' }, 'title'],
    ['sql in title', { title: "'; DROP TABLE users;--" }, 'title'],
    ['bad appointment id', { appointment_id: "1' OR '1'='1" }, 'appointment_id'],
    ['bad status', { status: 'published' }, 'status'],
    ['html in notes', { notes: '<img src=x onerror=alert(1)>' }, 'notes'],
  ]
  for (const [label, fields, field] of malicious) {
    it(`rejects malicious metadata: ${label}`, async () => {
      const { app, db } = setup()
      const error = await rejects(reports.store(await upload('scan.pdf', PDF, fields), app), ValidationError)
      assert.ok(field in error.fields)
      assert.deepEqual(writes(db), [])
    })
  }

  it('rejects a cancelled appointment and a mismatched patient', async () => {
    const { app, db } = setup()
    db.on('FROM appointments a', { id: APPOINTMENT, patient_id: PATIENT, status: 'cancelled', referral_id: null })
    const error = await rejects(reports.store(await upload('scan.pdf', PDF), app), ValidationError)
    assert.equal(error.fields.appointment_id, 'Choose an existing, non-cancelled appointment.')
    db.on('FROM appointments a', { id: APPOINTMENT, patient_id: PATIENT, status: 'confirmed', referral_id: null })
    const mismatch = await rejects(reports.store(await upload('scan.pdf', PDF, { patient_id: '00000000-0000-4000-8000-0000000000aa' }), app), ValidationError)
    assert.equal(mismatch.fields.patient_id, 'This appointment belongs to a different patient.')
  })

  it('stores a valid pdf encrypted under a random name and returns the clinical notes', async () => {
    const { app, db, crypto, storage, audit } = setup()
    const detail = {
      id: REPORT, appointment_id: APPOINTMENT, patient_id: PATIENT, title: 'CT Brain report', original_filename: 'scan.pdf',
      mime_type: 'application/pdf', size_bytes: PDF.length, is_critical: false, status: 'final', released_at: null,
      created_at: '2026-10-09 10:00:00+05:30', updated_at: '2026-10-09 10:00:00+05:30', patient_name: 'Dev Patient',
      appointment_reference: 'MDC-261009-AAAAA', scan_name: 'CT Brain', slot_date: '2026-10-09', referrer_id: null,
      findings_encrypted: crypto.encryptText('secret clinical note'), impression_encrypted: null,
    }
    db.on('INSERT INTO reports', { id: REPORT })
    db.on('FROM reports r', detail)

    const response = await reports.store(await upload('scan.pdf', PDF, { notes: 'secret clinical note' }), app)

    assert.equal(response.status, 201)
    assert.equal(storage.objects.size, 1)
    const [[objectPath, stored]] = [...storage.objects]
    assert.match(objectPath, /^reports\/\d{4}\/\d{2}\/[a-f0-9]{32}\.bin$/)
    assert.ok(!stored.includes('%PDF'))
    assert.equal(stored.length, PDF.length)
    const insert = db.ran('INSERT INTO reports')
    assert.equal(insert.length, 1)
    for (const column of ['sha256', 'encryption_iv', 'encryption_tag', 'key_version', 'findings_encrypted', 'storage_path']) {
      assert.ok(insert[0].sql.includes(column))
    }
    assert.ok(insert[0].params.includes(createHash('sha256').update(PDF).digest('hex')))
    assert.ok(audit.actions().includes('report.uploaded'))
    assert.equal(db.ran('INSERT INTO report_access_log').length, 1)
    assert.equal(response.decoded().data.report.notes, 'secret clinical note')
  })
})

describe('report access policy', () => {
  const report = { status: 'final', patient_user_id: 'pa', referrer_user_id: 'r1', deleted_at: null }
  const matrix = [
    ['owner patient', { id: 'pa', role: 'patient' }, report, true],
    ['other patient', { id: 'pb', role: 'patient' }, report, false],
    ['linked referrer', { id: 'r1', role: 'referrer' }, report, true],
    ['unrelated referrer', { id: 'r2', role: 'referrer' }, report, false],
    ['doctor', { id: 'd', role: 'doctor' }, report, true],
    ['receptionist', { id: 'x', role: 'receptionist' }, report, true],
    ['admin', { id: 'y', role: 'admin' }, report, true],
    ['owner patient draft', { id: 'pa', role: 'patient' }, { ...report, status: 'draft' }, false],
    ['linked referrer draft', { id: 'r1', role: 'referrer' }, { ...report, status: 'draft' }, false],
    ['doctor draft', { id: 'd', role: 'doctor' }, { ...report, status: 'draft' }, true],
    ['amended report released', { id: 'pa', role: 'patient' }, { ...report, status: 'amended' }, true],
    ['deleted for admin', { id: 'y', role: 'admin' }, { ...report, deleted_at: '2026-10-09' }, false],
    ['report without referrer', { id: 'r1', role: 'referrer' }, { ...report, referrer_user_id: null }, false],
    ['unknown role', { id: 'z', role: 'guest' }, report, false],
    ['missing user id', { role: 'patient' }, report, false],
  ]
  for (const [label, user, row, expected] of matrix) {
    it(label, () => assert.equal(canView(user, row), expected))
  }

  it('lets only admins delete', () => {
    assert.equal(canDelete({ role: 'admin' }), true)
    for (const role of ['doctor', 'receptionist', 'patient', 'referrer']) assert.equal(canDelete({ role }), false)
  })
})

describe('report download', () => {
  const PATIENT_A = '00000000-0000-4000-8000-0000000000a1'
  const PATIENT_B = '00000000-0000-4000-8000-0000000000b2'
  const REFERRER_1 = '00000000-0000-4000-8000-0000000000c1'
  const REFERRER_2 = '00000000-0000-4000-8000-0000000000c2'
  const body = Buffer.from('%PDF-1.4\nbody\n%%EOF\n')

  const seeded = async () => {
    const made = setup()
    const sealed = made.crypto.encrypt(body)
    const storagePath = `reports/2026/10/${'ab'.repeat(16)}.bin`
    await made.storage.put(storagePath, sealed.ciphertext)
    made.db.on('FROM reports r', {
      id: REPORT, appointment_id: 'ap', patient_id: 'pt', title: 'CT', original_filename: 'ct "x".pdf', storage_path: storagePath,
      mime_type: 'application/pdf', size_bytes: body.length, sha256: createHash('sha256').update(body).digest('hex'),
      encryption_iv: sealed.iv.toString('base64'), encryption_tag: sealed.tag.toString('base64'), key_version: 1,
      findings_encrypted: null, impression_encrypted: null, storage_driver: 'local', status: 'final', is_critical: false,
      released_at: null, deleted_at: null, created_at: '2026-10-09 10:00:00+05:30', updated_at: '2026-10-09 10:00:00+05:30',
      patient_name: 'Patient A', patient_user_id: PATIENT_A, appointment_reference: 'MDC-261009-AAAAA', referral_id: 'rf',
      scan_name: 'CT', slot_date: '2026-10-09', referrer_user_id: REFERRER_1, referrer_id: 'rr',
    })
    return { ...made, storagePath }
  }
  const request = (id, role, extra = {}) => makeRequest({ method: 'GET', user: { id, role }, params: { id: REPORT }, ...extra })

  it('returns decrypted bytes with hardened headers to the owner', async () => {
    const { app, db } = await seeded()
    const response = await reports.download(await request(PATIENT_A, 'patient'), app)
    assert.deepEqual(response.body, body)
    assert.equal(response.header('Content-Type'), 'application/pdf')
    assert.equal(response.header('X-Content-Type-Options'), 'nosniff')
    assert.match(response.header('Cache-Control'), /no-store/)
    assert.equal(response.header('Content-Disposition'), 'attachment; filename="ct _x_.pdf"')
    assert.equal(response.header('Content-Length'), String(body.length))
    assert.equal(db.ran('INSERT INTO report_access_log').length, 1)
  })

  it('hides another patient report and logs the denial', async () => {
    const { app, db, audit } = await seeded()
    await rejects(reports.download(await request(PATIENT_B, 'patient'), app), NotFoundError)
    assert.equal(db.ran('INSERT INTO report_access_log')[0].params[2], 'denied')
    assert.ok(audit.actions().includes('report.access_denied'))
    await rejects(reports.show(await request(PATIENT_B, 'patient'), app), NotFoundError)
  })

  it('lets only the linked referrer download', async () => {
    const { app } = await seeded()
    const ok = await reports.download(await request(REFERRER_1, 'referrer'), app)
    assert.deepEqual(ok.body, body)
    await rejects(reports.download(await request(REFERRER_2, 'referrer'), app), NotFoundError)
  })

  it('returns not found for unknown reports and non-admin deletes', async () => {
    const { app, db } = await seeded()
    db.on('FROM reports r', [])
    await rejects(reports.download(await request(REFERRER_2, 'referrer'), app), NotFoundError)
    await rejects(reports.destroy(await request('doc', 'doctor', { method: 'DELETE' }), app), NotFoundError)
  })

  it('fails closed when the stored file is tampered with', async () => {
    const { app, storage, storagePath } = await seeded()
    storage.objects.get(storagePath)[0] ^= 1
    const error = await reports.download(await request(PATIENT_A, 'patient'), app).catch((e) => e)
    assert.equal(error.constructor.name, 'EncryptionError')
  })

  it('fails when the integrity hash does not match', async () => {
    const { app, db } = await seeded()
    const row = db.handlers.find((h) => h.needle === 'FROM reports r').result
    row.sha256 = '0'.repeat(64)
    const error = await reports.download(await request(PATIENT_A, 'patient'), app).catch((e) => e)
    assert.ok(error instanceof StorageError)
  })

  it('admin delete removes the object and soft deletes the row', async () => {
    const { app, db, storage } = await seeded()
    const response = await reports.destroy(await request('adm', 'admin', { method: 'DELETE' }), app)
    assert.equal(response.status, 204)
    assert.equal(storage.objects.size, 0)
    assert.equal(db.ran('UPDATE reports SET deleted_at').length, 1)
    assert.equal(db.ran('INSERT INTO report_access_log')[0].params[2], 'delete')
  })
})

describe('storage drivers', () => {
  it('local storage round trips, refuses overwrite and bad paths', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'dc-store-'))
    try {
      const storage = new LocalStorage(root)
      const key = `reports/2026/10/${'cd'.repeat(16)}.bin`
      await storage.put(key, Buffer.from('hello'))
      assert.equal((await storage.get(key)).toString(), 'hello')
      assert.equal((await readFile(path.join(root, 'reports', '2026', '10', `${'cd'.repeat(16)}.bin`))).toString(), 'hello')
      await assert.rejects(storage.put(key, Buffer.from('again')), StorageError)
      await assert.rejects(storage.get('../etc/passwd.bin'), /Invalid storage path/)
      await assert.rejects(storage.get('reports/UPPER.bin'), /Invalid storage path/)
      await storage.delete(key)
      await storage.delete(key)
      await assert.rejects(storage.get(key), /missing/)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('supabase storage builds the same requests as PHP', async () => {
    const calls = []
    const reply = (status, text = '') => async (url, init) => {
      calls.push({ url, ...init })
      return new Response(text, { status })
    }
    const make = (status, text) => new SupabaseStorage({ baseUrl: 'https://x.supabase.co/', serviceKey: 'k', bucket: 'my reports', fetchImpl: reply(status, text) })
    const key = `reports/2026/10/${'ef'.repeat(16)}.bin`
    await make(200).put(key, Buffer.from('a'))
    assert.equal(calls[0].url, `https://x.supabase.co/storage/v1/object/my%20reports/${key}`)
    assert.equal(calls[0].method, 'POST')
    assert.equal(calls[0].headers['x-upsert'], 'false')
    assert.equal(calls[0].headers.Authorization, 'Bearer k')
    assert.equal((await make(200, 'data').get(key)).toString(), 'data')
    await assert.rejects(make(500).get(key), /HTTP 500/)
    await make(404).delete(key)
    await assert.rejects(make(403).delete(key), /HTTP 403/)
  })
})

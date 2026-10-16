import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { StorageError } from '../../core/errors.js'
import { atomTimestamp, zonedDate } from '../../core/time.js'

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/

const decodeBase64 = (value) => (BASE64.test(value) && value.length % 4 === 0 ? Buffer.from(value, 'base64') : null)

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')

export class ReportService {
  constructor({ db, reports, referrals, accessLog, storage, crypto, timezone }) {
    this.db = db
    this.reports = reports
    this.referrals = referrals
    this.accessLog = accessLog
    this.storage = storage
    this.crypto = crypto
    this.timezone = timezone
  }

  now() {
    return atomTimestamp(new Date(), this.timezone)
  }

  randomPath() {
    const [year, month] = zonedDate(new Date(), this.timezone).split('-')
    return `reports/${year}/${month}/${randomBytes(16).toString('hex')}.bin`
  }

  async store(user, appointment, upload, meta, ip, userAgent) {
    const bytes = upload.buffer
    if (bytes.length === 0) throw new StorageError('Could not read the uploaded file.')
    const sealed = this.crypto.encrypt(bytes)
    const path = this.randomPath()
    const status = meta.status

    await this.storage.put(path, sealed.ciphertext)
    try {
      const row = await this.db.tx(async (tx) => {
        const created = await this.reports.using(tx).create({
          appointment_id: appointment.id,
          patient_id: appointment.patient_id,
          uploaded_by_user_id: user.id,
          title: meta.title,
          original_filename: upload.original_name,
          storage_path: path,
          mime_type: upload.mime_type,
          size_bytes: upload.size_bytes,
          sha256: sha256(bytes),
          encryption_iv: sealed.iv.toString('base64'),
          encryption_tag: sealed.tag.toString('base64'),
          key_version: sealed.keyVersion,
          findings_encrypted: this.crypto.encryptNullable(meta.notes ?? null),
          impression_encrypted: this.crypto.encryptNullable(meta.impression ?? null),
          storage_driver: this.storage.driver(),
          status,
          released_at: status === 'draft' ? null : this.now(),
        })
        await this.accessLog.using(tx).record(created.id, user.id, 'upload', ip, userAgent)
        if (status !== 'draft' && appointment.referral_id) await this.markReferralReady(tx, appointment.referral_id)
        return created
      })
      return String(row.id)
    } catch (error) {
      try {
        await this.storage.delete(path)
      } catch {}
      throw error
    }
  }

  async update(existing, changes) {
    const values = {}
    for (const field of ['title', 'status']) {
      if (field in changes) values[field] = changes[field]
    }
    if ('notes' in changes) values.findings_encrypted = this.crypto.encryptNullable(changes.notes)
    if ('impression' in changes) values.impression_encrypted = this.crypto.encryptNullable(changes.impression)
    const released = values.status !== undefined && values.status !== 'draft'
    if (released && !existing.released_at) values.released_at = this.now()
    await this.db.tx(async (tx) => {
      await this.reports.using(tx).update(existing.id, values)
      if (released && existing.referral_id) await this.markReferralReady(tx, existing.referral_id)
    })
  }

  async read(report) {
    const ciphertext = await this.storage.get(String(report.storage_path))
    const iv = decodeBase64(String(report.encryption_iv))
    const tag = decodeBase64(String(report.encryption_tag))
    if (iv === null || tag === null) throw new StorageError('Stored encryption metadata is invalid.')
    const plaintext = this.crypto.decrypt(ciphertext, iv, tag, Number(report.key_version))
    const expected = Buffer.from(String(report.sha256))
    const actual = Buffer.from(sha256(plaintext))
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new StorageError('Stored file failed its integrity check.')
    }
    return plaintext
  }

  async remove(report) {
    await this.storage.delete(String(report.storage_path))
    await this.reports.markDeleted(report.id)
  }

  storageDriver() {
    return this.storage.driver()
  }

  async markReferralReady(tx, referralId) {
    const referrals = this.referrals.using(tx)
    const referral = await referrals.find(referralId)
    if (referral === null || ['report_ready', 'declined', 'cancelled'].includes(referral.status)) return
    await referrals.update(referralId, { status: 'report_ready', status_changed_at: this.now() })
  }
}

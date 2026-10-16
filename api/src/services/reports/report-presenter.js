import { toIso } from '../../core/time.js'
import { canSeeClinicalText } from './report-access-policy.js'

export class ReportPresenter {
  constructor({ crypto, timezone }) {
    this.crypto = crypto
    this.timezone = timezone
  }

  summary(row) {
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      mime_type: row.mime_type,
      size_bytes: Number(row.size_bytes),
      original_filename: row.original_filename,
      is_critical: Boolean(row.is_critical),
      patient: { id: row.patient_id, name: row.patient_name },
      appointment: {
        id: row.appointment_id,
        reference_code: row.appointment_reference,
        scan_name: row.scan_name,
        date: row.slot_date,
      },
      released_at: toIso(row.released_at ?? null, this.timezone),
      created_at: toIso(row.created_at, this.timezone),
      updated_at: toIso(row.updated_at, this.timezone),
    }
  }

  detail(row, user) {
    const data = this.summary(row)
    data.uploaded_by = row.uploaded_by_name ?? null
    data.has_referrer = Boolean(row.referrer_id)
    if (canSeeClinicalText(user)) {
      data.notes = this.crypto.decryptNullable(row.findings_encrypted ?? null)
      data.impression = this.crypto.decryptNullable(row.impression_encrypted ?? null)
    }
    return data
  }
}

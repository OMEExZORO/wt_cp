import { Model } from './model.js'

export class Patient extends Model {
  static table = 'patients'
  static fillable = [
    'user_id', 'full_name', 'date_of_birth', 'gender', 'phone', 'email', 'address', 'city',
    'emergency_contact_name', 'emergency_contact_phone', 'consent_given_at', 'consent_version', 'created_by_user_id',
  ]

  findByUserId(userId) {
    return this.db.one('SELECT * FROM patients WHERE user_id = $1', [userId])
  }

  findWalkIn(fullName, phone) {
    return this.db.one(
      'SELECT * FROM patients WHERE phone = $1 AND lower(full_name) = lower($2) ORDER BY created_at LIMIT 1',
      [phone, fullName],
    )
  }

  search(term, limit) {
    const pattern = `%${term.toLowerCase().replace(/[%_\\]/g, '\\$&')}%`
    const capped = Math.max(1, Math.min(limit, 25))
    return this.db.all(
      `SELECT id, full_name, phone FROM patients WHERE lower(full_name) LIKE $1 OR phone LIKE $1 ORDER BY full_name, created_at LIMIT ${capped}`,
      [pattern],
    )
  }

  syncContact(userId, fullName, phone) {
    return this.db.execute('UPDATE patients SET full_name = $1, phone = $2 WHERE user_id = $3', [fullName, phone, userId])
  }

  toPublic(patient) {
    return {
      patient_id: patient.id,
      date_of_birth: patient.date_of_birth ?? null,
      gender: patient.gender ?? null,
      city: patient.city ?? null,
    }
  }
}

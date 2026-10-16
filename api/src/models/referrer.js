import { Model } from './model.js'

export class Referrer extends Model {
  static table = 'referrers'
  static fillable = [
    'user_id', 'full_name', 'qualification', 'registration_number', 'clinic_name', 'phone', 'city',
    'verified_at', 'verified_by_user_id',
  ]

  findByUserId(userId) {
    return this.db.one('SELECT * FROM referrers WHERE user_id = $1', [userId])
  }

  syncContact(userId, fullName, phone) {
    return this.db.execute('UPDATE referrers SET full_name = $1, phone = $2 WHERE user_id = $3', [fullName, phone, userId])
  }

  toPublic(referrer) {
    return {
      referrer_id: referrer.id,
      qualification: referrer.qualification ?? null,
      registration_number: referrer.registration_number ?? null,
      clinic_name: referrer.clinic_name ?? null,
      city: referrer.city ?? null,
      is_verified: Boolean(referrer.verified_at),
    }
  }
}

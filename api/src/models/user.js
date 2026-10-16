import { toIso } from '../core/time.js'
import { Model } from './model.js'

export const ROLES = ['patient', 'receptionist', 'doctor', 'admin', 'referrer']

export class User extends Model {
  static table = 'users'
  static fillable = [
    'email', 'password_hash', 'role', 'full_name', 'phone', 'is_active', 'email_verified_at',
    'password_changed_at', 'consent_given_at', 'consent_version',
  ]

  findByEmail(email) {
    return this.db.one(
      `SELECT *,
              (locked_until IS NOT NULL AND locked_until > now()) AS is_locked,
              GREATEST(0, CEIL(EXTRACT(EPOCH FROM (locked_until - now()))))::int AS lock_seconds_remaining
       FROM users WHERE lower(email) = lower($1)`,
      [email],
    )
  }

  async emailExists(email) {
    return Boolean(await this.db.value('SELECT EXISTS (SELECT 1 FROM users WHERE lower(email) = lower($1))', [email]))
  }

  async registerFailure(id, maxAttempts, lockMinutes) {
    const row = await this.db.one(
      `UPDATE users SET
          failed_login_count = CASE WHEN failed_login_count + 1 >= $1 THEN 0 ELSE failed_login_count + 1 END,
          locked_until = CASE WHEN failed_login_count + 1 >= $1 THEN now() + make_interval(mins => $2) ELSE locked_until END
       WHERE id = $3
       RETURNING failed_login_count, (locked_until IS NOT NULL AND locked_until > now()) AS is_locked`,
      [maxAttempts, lockMinutes, id],
    )
    return row ?? { failed_login_count: 0, is_locked: false }
  }

  registerSuccess(id) {
    return this.db.execute('UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = now() WHERE id = $1', [id])
  }

  updatePassword(id, hash, changedAt) {
    return this.db.execute(
      'UPDATE users SET password_hash = $1, password_changed_at = $2, failed_login_count = 0, locked_until = NULL WHERE id = $3',
      [hash, changedAt, id],
    )
  }

  rehash(id, hash) {
    return this.db.execute('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id])
  }

  markEmailVerified(id) {
    return this.db.execute('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1', [id])
  }

  toPublic(user, profile = null) {
    const zone = this.options.timezone
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      phone: user.phone ?? null,
      email_verified: Boolean(user.email_verified_at),
      email_verified_at: toIso(user.email_verified_at, zone),
      last_login_at: toIso(user.last_login_at, zone),
      created_at: toIso(user.created_at, zone),
      profile,
    }
  }
}

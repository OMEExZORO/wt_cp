import { Model } from './model.js'

export class PasswordReset extends Model {
  static table = 'password_resets'

  async issue(userId, tokenHash, minutes, ip) {
    await this.db.execute('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [userId])
    await this.db.execute(
      `INSERT INTO password_resets (user_id, token_hash, expires_at, requested_ip)
       VALUES ($1, $2, now() + make_interval(mins => $3), $4)`,
      [userId, tokenHash, minutes, ip],
    )
  }

  async consume(tokenHash) {
    const userId = await this.db.value(
      `UPDATE password_resets SET used_at = now()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       RETURNING user_id`,
      [tokenHash],
    )
    return userId === null ? null : String(userId)
  }
}

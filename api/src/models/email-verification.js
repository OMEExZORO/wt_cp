import { Model } from './model.js'

export class EmailVerification extends Model {
  static table = 'email_verifications'

  async issue(userId, tokenHash, hours) {
    await this.db.execute('UPDATE email_verifications SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [userId])
    await this.db.execute(
      `INSERT INTO email_verifications (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + make_interval(hours => $3))`,
      [userId, tokenHash, hours],
    )
  }

  async consume(tokenHash) {
    const userId = await this.db.value(
      `UPDATE email_verifications SET used_at = now()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       RETURNING user_id`,
      [tokenHash],
    )
    return userId === null ? null : String(userId)
  }
}

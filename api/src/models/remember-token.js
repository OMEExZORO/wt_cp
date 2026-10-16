import { Model } from './model.js'

export class RememberToken extends Model {
  static table = 'remember_tokens'
  static fillable = ['user_id', 'selector', 'validator_hash', 'expires_at', 'user_agent', 'ip_address']

  findBySelector(selector) {
    return this.db.one(
      `SELECT *,
              (expires_at <= now()) AS is_expired,
              (rotated_at IS NOT NULL AND rotated_at > now() - make_interval(secs => $2)) AS in_grace
       FROM remember_tokens WHERE selector = $1`,
      [selector, 60],
    )
  }

  issue(userId, selector, validatorHash, days, userAgent, ip) {
    return this.db.execute(
      `INSERT INTO remember_tokens (user_id, selector, validator_hash, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, now() + make_interval(days => $4), $5, $6)`,
      [userId, selector, validatorHash, days, userAgent, ip],
    )
  }

  rotate(id, newHash, previousHash, days, userAgent, ip) {
    return this.db.execute(
      `UPDATE remember_tokens
       SET validator_hash = $1, previous_validator_hash = $2, rotated_at = now(),
           last_used_at = now(), expires_at = now() + make_interval(days => $3),
           user_agent = $4, ip_address = $5
       WHERE id = $6`,
      [newHash, previousHash, days, userAgent, ip, id],
    )
  }

  deleteBySelector(selector) {
    return this.db.execute('DELETE FROM remember_tokens WHERE selector = $1', [selector])
  }

  deleteForUser(userId) {
    return this.db.execute('DELETE FROM remember_tokens WHERE user_id = $1', [userId])
  }

  async countForUser(userId) {
    return Number(await this.db.value('SELECT count(*) FROM remember_tokens WHERE user_id = $1', [userId]))
  }
}

import { Model } from './model.js'

export class LoginAttempt extends Model {
  static table = 'login_attempts'

  record(email, ip, succeeded, userAgent) {
    return this.db.execute(
      'INSERT INTO login_attempts (email, ip_address, succeeded, user_agent) VALUES ($1, $2, $3, $4)',
      [[...email].slice(0, 254).join(''), ip, succeeded, userAgent],
    )
  }

  async recentFailuresForEmail(email, minutes) {
    return Number(
      await this.db.value(
        `SELECT count(*) FROM login_attempts
         WHERE lower(email) = lower($1) AND succeeded = FALSE
           AND attempted_at > now() - make_interval(mins => $2)
           AND attempted_at > COALESCE((
               SELECT max(attempted_at) FROM login_attempts
               WHERE lower(email) = lower($1) AND succeeded = TRUE
           ), '-infinity'::timestamptz)`,
        [email, minutes],
      ),
    )
  }
}

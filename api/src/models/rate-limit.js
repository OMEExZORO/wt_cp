import { Model } from './model.js'

export class RateLimit extends Model {
  static table = 'rate_limits'
  static primaryKey = 'bucket'

  async hit(bucket, windowSeconds) {
    const row = await this.db.one(
      `INSERT INTO rate_limits (bucket, hits, window_started_at) VALUES ($1, 1, now())
       ON CONFLICT (bucket) DO UPDATE SET
          hits = CASE WHEN rate_limits.window_started_at <= now() - make_interval(secs => $2) THEN 1 ELSE rate_limits.hits + 1 END,
          window_started_at = CASE WHEN rate_limits.window_started_at <= now() - make_interval(secs => $2) THEN now() ELSE rate_limits.window_started_at END
       RETURNING hits, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (window_started_at + make_interval(secs => $2) - now()))))::int AS retry_after`,
      [bucket, windowSeconds],
    )
    return row ?? { hits: 1, retry_after: windowSeconds }
  }

  clear(bucket) {
    return this.db.execute('DELETE FROM rate_limits WHERE bucket = $1', [bucket])
  }

  purgeOlderThan(seconds) {
    return this.db.execute('DELETE FROM rate_limits WHERE window_started_at < now() - make_interval(secs => $1)', [seconds])
  }
}

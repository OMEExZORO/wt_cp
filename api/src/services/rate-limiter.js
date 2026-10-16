import { RateLimitError } from '../core/errors.js'

const bucketName = (bucket) => [...bucket].slice(0, 200).join('')

export class RateLimiter {
  constructor({ limits }) {
    this.limits = limits
  }

  async attempt(bucket, max, windowSeconds, message = null) {
    const result = await this.limits.hit(bucketName(bucket), windowSeconds)
    if (Number(result.hits) > max) {
      throw new RateLimitError(message ?? 'Too many requests. Please wait a few minutes and try again.', Number(result.retry_after))
    }
  }

  clear(bucket) {
    return this.limits.clear(bucketName(bucket))
  }
}

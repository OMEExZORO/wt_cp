import { RateLimitError } from '../core/errors.js'

export const rateLimit = ({ audit, limiter }) => async (req, next, name = 'default', max = '60', minutes = '1') => {
  const limit = Math.max(1, Number.parseInt(max, 10) || 1)
  const windowMinutes = Math.max(1, Number.parseInt(minutes, 10) || 1)
  const identity = req.user?.id ?? req.ip ?? 'unknown'
  try {
    await limiter.attempt(`${name}:${identity}`, limit, windowMinutes * 60)
  } catch (error) {
    if (error instanceof RateLimitError) await audit.log('security.rate_limited', req, { metadata: { limiter: name } })
    throw error
  }
  return next(req)
}

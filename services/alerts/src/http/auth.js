import crypto from 'node:crypto'
import { config } from '../config.js'

const digest = (value) => crypto.createHash('sha256').update(value).digest()

export const requireServiceToken = (req, res, next) => {
  if (!config.serviceToken) {
    return res.status(503).json({ data: null, error: { code: 'NOT_CONFIGURED', message: 'Service token is not configured.' } })
  }
  const header = req.get('authorization') ?? ''
  const provided = req.get('x-service-token') ?? (header.startsWith('Bearer ') ? header.slice(7) : '')
  if (!provided || !crypto.timingSafeEqual(digest(provided), digest(config.serviceToken))) {
    return res.status(401).json({ data: null, error: { code: 'UNAUTHENTICATED', message: 'Invalid or missing service token.' } })
  }
  next()
}

import { authenticate } from './authenticate.js'
import { cors } from './cors.js'
import { csrf } from './csrf.js'
import { handleErrors } from './handle-errors.js'
import { matchRoute } from './match-route.js'
import { rateLimit } from './rate-limit.js'
import { requireAuth } from './require-auth.js'
import { role } from './role.js'
import { securityHeaders } from './security-headers.js'
import { startSession } from './start-session.js'
import { verifiedEmail } from './verified-email.js'
import { parseMiddlewareSpec } from '../core/pipeline.js'

export const routeMiddlewareFactories = {
  auth: requireAuth,
  role,
  verified: verifiedEmail,
  throttle: rateLimit,
}

export const buildGlobalMiddleware = (app) => [
  cors(app),
  securityHeaders(app),
  handleErrors(app),
  matchRoute(app),
  startSession(app),
  authenticate(app),
  csrf(app),
]

export const createRouteMiddlewareResolver = (app) => (spec) => {
  const { name, params } = parseMiddlewareSpec(spec)
  const factory = routeMiddlewareFactories[name]
  if (!factory) throw new Error(`Unknown middleware ${name}`)
  const middleware = factory(app)
  return (req, next) => middleware(req, next, ...params)
}

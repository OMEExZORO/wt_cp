import { AuthorizationError } from '../core/errors.js'
import { ApiResponse } from '../core/response.js'

const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
const ALLOWED_HEADERS = 'Accept, Content-Type, X-CSRF-Token, X-Requested-With'

export const cors = ({ config }) => {
  const isAllowed = (origin) => config.cors.allowedOrigins.includes(origin.replace(/\/+$/, ''))

  const apply = (response, origin) => {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Access-Control-Allow-Credentials', 'true')
    response.setHeader('Access-Control-Expose-Headers', 'Retry-After')
  }

  return async (req, next) => {
    const origin = req.header('origin')
    const allowed = origin !== null && isAllowed(origin)

    if (req.method === 'OPTIONS' && req.header('access-control-request-method') !== null) {
      const response = ApiResponse.noContent()
      if (allowed) {
        apply(response, origin)
        response.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS)
        response.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS)
        response.setHeader('Access-Control-Max-Age', config.cors.maxAge)
      }
      response.setHeader('Vary', 'Origin')
      return response
    }

    if (origin !== null && !allowed && !req.isMethodSafe()) {
      throw new AuthorizationError('This origin is not allowed to call the API.')
    }

    const response = await next(req)
    if (allowed) apply(response, origin)
    response.setHeader('Vary', 'Origin')
    return response
  }
}

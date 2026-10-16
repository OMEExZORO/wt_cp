import { AuthenticationError, AuthorizationError } from '../core/errors.js'

export const verifiedEmail = () => async (req, next) => {
  if (req.user === null) throw new AuthenticationError()
  if (!req.user.email_verified_at) throw new AuthorizationError('Please verify your email address to use this feature.')
  return next(req)
}

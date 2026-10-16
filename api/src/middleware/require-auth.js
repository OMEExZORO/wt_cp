import { AuthenticationError } from '../core/errors.js'

export const requireAuth = () => async (req, next) => {
  if (req.user === null) {
    throw new AuthenticationError(
      req.sessionExpired ? 'Your session expired due to inactivity. Please sign in again.' : 'Please sign in to continue.',
    )
  }
  return next(req)
}

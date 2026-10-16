import { AuthenticationError, AuthorizationError } from '../core/errors.js'
import { ROLES } from '../models/user.js'

export const role = ({ audit }) => async (req, next, ...roles) => {
  if (roles.length === 0) throw new Error('Role middleware needs at least one role')
  for (const name of roles) {
    if (!ROLES.includes(name)) throw new Error(`Unknown role ${name}`)
  }
  if (req.user === null) throw new AuthenticationError()
  if (!roles.includes(req.user.role)) {
    await audit.log('security.forbidden', req, { metadata: { required_roles: roles } })
    throw new AuthorizationError()
  }
  return next(req)
}

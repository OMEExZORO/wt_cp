import { AuthenticationError } from './errors.js'

export const requireUser = (req) => {
  if (req.user === null) throw new AuthenticationError()
  return req.user
}

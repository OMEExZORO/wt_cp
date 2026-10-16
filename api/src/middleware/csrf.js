import { CSRF_HEADER } from '../core/csrf.js'
import { CsrfError } from '../core/errors.js'

export const csrf = ({ audit }) => async (req, next) => {
  if (!req.isMethodSafe() && !req.csrf.validate(req.header(CSRF_HEADER))) {
    await audit.log('security.csrf_rejected', req, {
      metadata: { had_token: req.header(CSRF_HEADER) !== null },
    })
    throw new CsrfError()
  }
  return next(req)
}

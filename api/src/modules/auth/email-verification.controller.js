import { ConflictError } from '../../core/errors.js'
import { message, ok } from '../../core/response.js'
import { requireUser } from '../../core/http.js'

export const verify = async (req, app) => {
  const data = await app.validate(req, { token: 'required|token' })
  const verified = await app.services.verification.verify(data.token, req)
  const sameUser = req.user !== null && req.user.id === verified.id
  return ok({
    message: 'Thank you. Your email address is verified.',
    user: sameUser ? await app.services.auth.present(verified) : null,
  })
}

export const resend = async (req, app) => {
  const user = requireUser(req)
  if (user.email_verified_at) throw new ConflictError('Your email address is already verified.')
  await app.services.verification.send(user)
  return message('We have sent a new verification link to your email address.')
}

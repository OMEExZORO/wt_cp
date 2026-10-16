import { message } from '../../core/response.js'
import { requireUser } from '../../core/http.js'

export const forgot = async (req, app) => {
  const data = await app.validate(req, { email: 'required|email|max:254' })
  await app.services.passwords.requestReset(data.email, req)
  return message('If an account exists for that email, we have sent a link to reset the password.')
}

export const reset = async (req, app) => {
  const data = await app.validate(req, {
    token: 'required|token',
    password: 'required|password|confirmed',
  })
  await app.services.passwords.reset(data.token, data.password, req)
  return message('Your password has been reset. You can now sign in.')
}

export const change = async (req, app) => {
  const user = requireUser(req)
  const data = await app.validate(req, {
    current_password: 'required|raw|max:128',
    password: 'required|password|confirmed|different:current_password',
  })
  await app.services.passwords.change(req, user, data.current_password, data.password)
  return message('Your password has been changed. Other devices have been signed out.')
}

import { CSRF_HEADER } from '../../core/csrf.js'
import { created, message, ok } from '../../core/response.js'
import { requireUser } from '../../core/http.js'

export const ACCOUNT_RULES = {
  account_type: 'required|in:patient,referrer',
  full_name: 'required|name|min:2|max:120',
  email: 'required|email|max:254',
  phone: 'required|phone',
  password: 'required|password|confirmed',
  consent: 'required|accepted',
}

export const PATIENT_RULES = {
  date_of_birth: 'nullable|date|after:1900-01-01|before:today',
  gender: 'nullable|in:female,male,other,prefer_not_to_say',
  city: 'nullable|string|min:2|max:80',
}

export const REFERRER_RULES = {
  qualification: 'required|string|min:2|max:120',
  registration_number: 'required|registration_number',
  clinic_name: 'required|string|min:2|max:160',
  city: 'required|string|min:2|max:80',
}

const CONSENT_MESSAGES = {
  'consent.required': 'Please give your consent to continue.',
  'consent.accepted': 'Please give your consent to continue.',
}

export const csrf = (req) => ok({ csrf_token: req.csrf.token(), header: CSRF_HEADER })

export const register = async (req, app) => {
  const { account_type: type } = await app.validate(req, { account_type: ACCOUNT_RULES.account_type })
  const rules = { ...ACCOUNT_RULES, ...(type === 'referrer' ? REFERRER_RULES : PATIENT_RULES) }
  const data = await app.validate(req, rules, CONSENT_MESSAGES)
  const user = await app.services.registration.register(data, req)
  req.user = user
  return created({ user: await app.services.auth.present(user) })
}

export const login = async (req, app) => {
  const data = await app.validate(req, {
    email: 'required|email|max:254',
    password: 'required|raw|max:128',
    remember: 'nullable|boolean',
  })
  const user = await app.services.auth.login(data.email, data.password, data.remember === true, req)
  return ok({ user: await app.services.auth.present(user) })
}

export const logout = async (req, app) => {
  await app.services.auth.logout(req)
  return message('You have been signed out.')
}

export const logoutEverywhere = async (req, app) => {
  const revoked = await app.services.auth.logoutEverywhere(req, requireUser(req))
  return ok({ message: 'You have been signed out on all devices.', revoked_tokens: revoked })
}

export const me = async (req, app) => ok({ user: await app.services.auth.present(requireUser(req)) })

export const updateMe = async (req, app) => {
  let user = requireUser(req)
  const data = await app.validate(req, {
    full_name: 'sometimes|required|name|min:2|max:120',
    phone: 'sometimes|required|phone',
  })
  if (Object.keys(data).length > 0) {
    const { users, patients, referrers } = app.models
    const updated = (await users.update(String(user.id), data)) ?? user
    if (user.role === 'patient') {
      await patients.syncContact(String(user.id), String(updated.full_name), updated.phone)
    } else if (user.role === 'referrer') {
      await referrers.syncContact(String(user.id), String(updated.full_name), updated.phone)
    }
    await app.audit.log('user.profile_updated', req, {
      entity_type: 'user',
      entity_id: user.id,
      metadata: { fields: Object.keys(data) },
    })
    user = updated
  }
  return ok({ user: await app.services.auth.present(user) })
}

import { createHash, randomBytes } from 'node:crypto'
import { ConflictError, ValidationError } from '../../core/errors.js'
import { requireUser } from '../../core/http.js'
import { created, message, ok } from '../../core/response.js'
import { sqlTimestamp, toIso } from '../../core/time.js'
import { ROLES } from '../../models/user.js'
import { hashPassword } from '../../services/password-hasher.js'
import { flag, pagination, paged, record, requireFound, runWrite, uuidParam, withoutNulls } from '../../services/admin/admin-support.js'

export const STAFF_ROLES = ['receptionist', 'doctor', 'admin']

const present = (row, app) => ({
  id: row.id,
  email: row.email,
  full_name: row.full_name,
  phone: row.phone ?? null,
  role: row.role,
  is_active: flag(row.is_active),
  email_verified: Boolean(row.email_verified_at),
  last_login_at: toIso(row.last_login_at ?? null, app.config.timezone),
  created_at: toIso(row.created_at ?? null, app.config.timezone),
})

const assertNotLastAdmin = async (app, target, field) => {
  if (target.role === 'admin' && flag(target.is_active) && (await app.models.adminRepository.activeAdminCount()) <= 1) {
    throw ValidationError.withField(field, 'At least one active administrator must remain.')
  }
}

export const index = async (req, app) => {
  const [page, perPage, offset] = await pagination(req, app)
  const validated = await app.validate(req, {
    role: `nullable|in:${ROLES.join(',')}`,
    is_active: 'nullable|boolean',
    q: 'nullable|string|max:80',
  })
  const filters = withoutNulls(validated)
  const repository = app.models.adminRepository
  const users = (await repository.users(filters, perPage, offset)).map((row) => present(row, app))
  return paged('users', users, await repository.userCount(filters), page, perPage)
}

export const store = async (req, app) => {
  const data = await app.validate(req, {
    email: 'required|email',
    full_name: 'required|name|min:2|max:120',
    phone: 'nullable|phone',
    role: `required|in:${STAFF_ROLES.join(',')}`,
    password: 'required|password',
  })
  const users = app.models.users
  if (await users.emailExists(data.email)) {
    throw new ConflictError('An account with this email already exists.', { email: 'An account with this email already exists.' })
  }
  const now = sqlTimestamp(new Date(), app.config.timezone)
  const passwordHash = await hashPassword(data.password)
  const user = await runWrite(
    () =>
      users.create({
        email: data.email,
        password_hash: passwordHash,
        role: data.role,
        full_name: data.full_name,
        phone: data.phone ?? null,
        email_verified_at: now,
        password_changed_at: now,
      }),
    'An account with this email already exists.',
  )
  await record(app, req, 'admin.user_created', 'user', String(user.id), { role: data.role })
  return created(present((await app.models.adminRepository.userById(String(user.id))) ?? user, app))
}

export const update = async (req, app) => {
  const id = uuidParam(req)
  const actor = requireUser(req)
  const repository = app.models.adminRepository
  const target = requireFound(await repository.userById(id), 'User')
  const data = await app.validate(req, {
    full_name: 'sometimes|required|name|min:2|max:120',
    phone: 'sometimes|nullable|phone',
    role: `sometimes|required|in:${ROLES.join(',')}`,
    is_active: 'sometimes|required|boolean',
  })

  const targetIsSelf = String(target.id) === String(actor.id)
  const isStaff = STAFF_ROLES.includes(target.role)

  if (data.role !== undefined && data.role !== null && data.role !== target.role) {
    if (!isStaff || !STAFF_ROLES.includes(data.role)) {
      throw ValidationError.withField('role', 'Only staff accounts can change between receptionist, doctor and admin.')
    }
    if (targetIsSelf) throw ValidationError.withField('role', 'You cannot change your own role.')
    await assertNotLastAdmin(app, target, 'role')
  }
  if (data.is_active === false && flag(target.is_active)) {
    if (targetIsSelf) throw ValidationError.withField('is_active', 'You cannot deactivate your own account.')
    await assertNotLastAdmin(app, target, 'is_active')
  }

  const updated = await runWrite(() => app.models.users.update(id, data), 'This change conflicts with an existing record.')
  if (data.is_active === false) await app.services.remember.revokeAll(id)
  await record(app, req, 'admin.user_updated', 'user', id, { fields: Object.keys(data) })
  return ok(present((await repository.userById(id)) ?? updated ?? target, app))
}

export const passwordReset = async (req, app) => {
  const id = uuidParam(req)
  const target = requireFound(await app.models.users.find(id), 'User')
  if (!flag(target.is_active)) throw new ConflictError('Activate this account before sending a password reset.')
  const token = randomBytes(32).toString('hex')
  const minutes = app.config.auth.resetTokenMinutes
  await app.models.passwordResets.issue(id, createHash('sha256').update(token).digest('hex'), minutes, req.ip)
  await app.mail.sendTemplate(String(target.email), String(target.full_name), 'password-reset', {
    name: target.full_name,
    link: `${app.config.frontendUrl}/reset-password?token=${token}`,
    minutes,
  })
  await record(app, req, 'admin.user_password_reset_sent', 'user', id)
  return message('A password reset link has been sent to the user.')
}

import { createHash, randomBytes } from 'node:crypto'
import { ValidationError } from '../core/errors.js'
import { epochSeconds, humanTimestamp, sqlTimestamp } from '../core/time.js'
import { hashPassword, verifyPassword } from './password-hasher.js'

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const INVALID_RESET = 'This reset link is invalid or has expired. Please request a new one.'

export class PasswordService {
  constructor({ users, resets, remember, auth, limiter, mail, audit, config }) {
    this.users = users
    this.resets = resets
    this.remember = remember
    this.auth = auth
    this.limiter = limiter
    this.mail = mail
    this.audit = audit
    this.config = config
  }

  async requestReset(email, req) {
    await this.limiter.attempt(`forgot-email:${sha256(email)}`, 3, 3600, 'Too many reset requests. Please wait and try again.')
    const user = await this.users.findByEmail(email)
    if (user === null || !user.is_active) {
      await this.audit.log('auth.password_reset_requested', req, { metadata: { email_found: false } })
      return
    }

    const token = randomBytes(32).toString('hex')
    const minutes = this.config.auth.resetTokenMinutes
    await this.resets.issue(String(user.id), sha256(token), minutes, req.ip)
    await this.mail.sendTemplate(String(user.email), String(user.full_name), 'password-reset', {
      name: user.full_name,
      link: `${this.config.frontendUrl}/reset-password?token=${token}`,
      minutes,
    })
    await this.audit.log('auth.password_reset_requested', req, {
      entity_type: 'user',
      entity_id: user.id,
      metadata: { email_found: true },
    })
  }

  async reset(token, password, req) {
    const userId = await this.resets.consume(sha256(token))
    if (userId === null) throw ValidationError.withField('token', INVALID_RESET)
    const user = await this.users.find(userId)
    if (user === null) throw ValidationError.withField('token', INVALID_RESET)

    const changedAt = await this.store(req, user, password)
    await this.notifyChanged(user, changedAt)
    await this.audit.log('auth.password_reset', req, { actor: user, entity_type: 'user', entity_id: userId })
  }

  async change(req, user, current, next) {
    if (!(await verifyPassword(current, String(user.password_hash)))) {
      await this.audit.log('auth.password_change_failed', req, { entity_type: 'user', entity_id: user.id })
      throw ValidationError.withField('current_password', 'Your current password is incorrect.')
    }
    if (await verifyPassword(next, String(user.password_hash))) {
      throw ValidationError.withField('password', 'Choose a password different from your current one.')
    }

    const changedAt = await this.store(req, user, next)
    this.auth.refreshAuthTime(req, epochSeconds(changedAt) ?? Math.floor(Date.now() / 1000))
    await this.notifyChanged(user, changedAt)
    await this.audit.log('auth.password_changed', req, { entity_type: 'user', entity_id: user.id })
  }

  async store(req, user, password) {
    const changedAt = sqlTimestamp(new Date(), this.config.timezone)
    await this.users.updatePassword(String(user.id), await hashPassword(password), changedAt)
    await this.remember.revokeAll(String(user.id))
    this.remember.forgetCookie(req)
    return changedAt
  }

  notifyChanged(user, changedAt) {
    return this.mail.sendTemplate(String(user.email), String(user.full_name), 'password-changed', {
      name: user.full_name,
      changed_at: humanTimestamp(new Date(epochSeconds(changedAt) * 1000), this.config.timezone),
      reset_link: `${this.config.frontendUrl}/forgot-password`,
    })
  }
}

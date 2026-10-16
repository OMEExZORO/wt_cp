import { AuthenticationError, RateLimitError } from '../core/errors.js'
import { epochSeconds } from '../core/time.js'
import { needsRehash, hashPassword, verifyPassword } from './password-hasher.js'

const DUMMY_HASH = '$argon2id$v=19$m=65536,t=4,p=1$QnJsOU0waDZXRC5KN0VKaA$CDwCSZ8zD7Ib0S7ObUWOTwrxhs35Ij6p/qiEwSWqqic'
const GENERIC_FAILURE = 'Incorrect email or password.'

const lockedError = (seconds) => {
  const minutes = Math.max(1, Math.ceil(seconds / 60))
  return new RateLimitError(
    `Too many failed sign-in attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    Math.max(1, seconds),
  )
}

export class AuthService {
  constructor({ users, patients, referrers, attempts, remember, audit, config }) {
    this.users = users
    this.patients = patients
    this.referrers = referrers
    this.attempts = attempts
    this.remember = remember
    this.audit = audit
    this.config = config
  }

  async resolveUser(req) {
    const userId = req.session.get('user_id')
    if (typeof userId === 'string') {
      const user = await this.users.find(userId)
      if (user !== null && this.sessionStillValid(req, user)) return user
      this.clearSessionAuth(req)
    }

    const user = await this.remember.consume(req)
    if (user === null) return null
    this.startSession(req, user)
    await this.audit.log('auth.remember_login', req, { actor: user, entity_type: 'user', entity_id: user.id })
    return user
  }

  async login(email, password, remember, req) {
    const { maxFailedAttempts: maxAttempts, lockoutMinutes: lockMinutes } = this.config.auth
    const user = await this.users.findByEmail(email)

    if (user !== null && user.is_locked) {
      await this.attempts.record(email, req.ip, false, req.userAgent)
      await this.audit.log('auth.login_blocked', req, { entity_type: 'user', entity_id: user.id })
      throw lockedError(Number(user.lock_seconds_remaining))
    }

    if (user === null && (await this.attempts.recentFailuresForEmail(email, lockMinutes)) >= maxAttempts) {
      await this.attempts.record(email, req.ip, false, req.userAgent)
      throw lockedError(lockMinutes * 60)
    }

    const valid = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH)
    if (user === null || !valid || !user.is_active) {
      await this.attempts.record(email, req.ip, false, req.userAgent)
      const reason = user === null ? 'unknown_email' : !valid ? 'bad_password' : 'inactive'
      const metadata = { email, reason }
      if (user !== null && !valid) {
        const state = await this.users.registerFailure(String(user.id), maxAttempts, lockMinutes)
        if (state.is_locked) {
          await this.audit.log('auth.account_locked', req, { entity_type: 'user', entity_id: user.id, metadata: { minutes: lockMinutes } })
          await this.audit.log('auth.login_failed', req, { entity_type: 'user', entity_id: user.id, metadata })
          throw lockedError(lockMinutes * 60)
        }
      }
      await this.audit.log('auth.login_failed', req, { entity_type: 'user', entity_id: user?.id ?? null, metadata })
      throw new AuthenticationError(GENERIC_FAILURE)
    }

    if (this.config.auth.requireVerifiedEmailForLogin && !user.email_verified_at) {
      throw new AuthenticationError('Please verify your email address before signing in.')
    }

    if (needsRehash(user.password_hash)) {
      await this.users.rehash(String(user.id), await hashPassword(password))
    }

    await this.users.registerSuccess(String(user.id))
    await this.attempts.record(email, req.ip, true, req.userAgent)
    await this.remember.forgetCurrent(req)
    this.startSession(req, user)
    if (remember) await this.remember.issue(String(user.id), req)

    await this.audit.log('auth.login_succeeded', req, {
      actor: user,
      entity_type: 'user',
      entity_id: user.id,
      metadata: { remember },
    })
    return (await this.users.find(String(user.id))) ?? user
  }

  startSession(req, user) {
    req.session.regenerate()
    req.session.set('user_id', String(user.id))
    req.session.set('role', String(user.role))
    req.session.set('auth_time', Math.floor(Date.now() / 1000))
  }

  refreshAuthTime(req, timestamp) {
    req.session.regenerate()
    req.session.set('auth_time', timestamp)
  }

  async logout(req) {
    const user = req.user
    await this.remember.forgetCurrent(req)
    req.session.destroy()
    if (user !== null) {
      await this.audit.log('auth.logout', req, { actor: user, entity_type: 'user', entity_id: user.id })
    }
  }

  async logoutEverywhere(req, user) {
    const revoked = await this.remember.revokeAll(String(user.id))
    this.remember.forgetCookie(req)
    req.session.destroy()
    await this.audit.log('auth.logout_all', req, {
      actor: user,
      entity_type: 'user',
      entity_id: user.id,
      metadata: { revoked_tokens: revoked },
    })
    return revoked
  }

  async present(user) {
    let profile = null
    if (user.role === 'patient') {
      const patient = await this.patients.findByUserId(String(user.id))
      profile = patient === null ? null : this.patients.toPublic(patient)
    } else if (user.role === 'referrer') {
      const referrer = await this.referrers.findByUserId(String(user.id))
      profile = referrer === null ? null : this.referrers.toPublic(referrer)
    }
    return this.users.toPublic(user, profile)
  }

  sessionStillValid(req, user) {
    if (!user.is_active) return false
    if (req.session.get('role') !== user.role) return false
    const authTime = req.session.get('auth_time')
    if (!Number.isInteger(authTime)) return false
    if (user.password_changed_at) {
      const changed = epochSeconds(user.password_changed_at)
      if (changed !== null && changed > authTime) return false
    }
    return true
  }

  clearSessionAuth(req) {
    req.session.remove('user_id')
    req.session.remove('role')
    req.session.remove('auth_time')
    req.session.regenerate()
  }
}

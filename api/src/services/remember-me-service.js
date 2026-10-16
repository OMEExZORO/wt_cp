import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

const COOKIE_PATTERN = /^([a-f0-9]{24})\.([a-f0-9]{64})$/

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const safeEqual = (a, b) => {
  const left = Buffer.from(String(a))
  const right = Buffer.from(String(b))
  return left.length === right.length && timingSafeEqual(left, right)
}

export class RememberMeService {
  constructor({ tokens, users, cookies, config, audit }) {
    this.tokens = tokens
    this.users = users
    this.cookies = cookies
    this.config = config
    this.audit = audit
  }

  get cookieName() {
    return this.config.remember.cookie
  }

  get days() {
    return Math.max(1, this.config.remember.days)
  }

  expiry() {
    return Math.floor(Date.now() / 1000) + this.days * 86400
  }

  async issue(userId, req) {
    const selector = randomBytes(12).toString('hex')
    const validator = randomBytes(32).toString('hex')
    await this.tokens.issue(userId, selector, sha256(validator), this.days, req.userAgent, req.ip)
    this.cookies.set(req, this.cookieName, `${selector}.${validator}`, this.expiry())
  }

  async consume(req) {
    const raw = req.cookie(this.cookieName)
    if (raw === null) return null
    const match = COOKIE_PATTERN.exec(raw)
    if (match === null) {
      this.cookies.forget(req, this.cookieName)
      return null
    }
    const [, selector, validator] = match
    const token = await this.tokens.findBySelector(selector)
    if (token === null) {
      this.cookies.forget(req, this.cookieName)
      return null
    }
    if (token.is_expired) {
      await this.tokens.deleteBySelector(selector)
      this.cookies.forget(req, this.cookieName)
      return null
    }

    const hash = sha256(validator)
    const user = await this.users.find(String(token.user_id))
    if (user === null || !user.is_active) {
      await this.tokens.deleteBySelector(selector)
      this.cookies.forget(req, this.cookieName)
      return null
    }

    if (safeEqual(token.validator_hash, hash)) {
      const newValidator = randomBytes(32).toString('hex')
      await this.tokens.rotate(token.id, sha256(newValidator), hash, this.days, req.userAgent, req.ip)
      this.cookies.set(req, this.cookieName, `${selector}.${newValidator}`, this.expiry())
      return user
    }

    if (token.previous_validator_hash !== null && token.in_grace && safeEqual(token.previous_validator_hash, hash)) {
      return user
    }

    const revoked = await this.tokens.deleteForUser(String(token.user_id))
    this.cookies.forget(req, this.cookieName)
    await this.audit.log('auth.remember_token_theft', req, {
      actor: user,
      entity_type: 'user',
      entity_id: user.id,
      metadata: { revoked_tokens: revoked },
    })
    return null
  }

  async forgetCurrent(req) {
    const raw = req.cookie(this.cookieName)
    const match = raw === null ? null : COOKIE_PATTERN.exec(raw)
    if (match !== null) await this.tokens.deleteBySelector(match[1])
    this.cookies.forget(req, this.cookieName)
  }

  revokeAll(userId) {
    return this.tokens.deleteForUser(userId)
  }

  forgetCookie(req) {
    this.cookies.forget(req, this.cookieName)
  }
}

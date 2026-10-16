import { createHash, randomBytes } from 'node:crypto'
import { ValidationError } from '../core/errors.js'

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

export class EmailVerificationService {
  constructor({ verifications, users, mail, audit, config }) {
    this.verifications = verifications
    this.users = users
    this.mail = mail
    this.audit = audit
    this.config = config
  }

  async send(user) {
    const token = randomBytes(32).toString('hex')
    const hours = this.config.auth.verifyTokenHours
    await this.verifications.issue(String(user.id), sha256(token), hours)
    return this.mail.sendTemplate(String(user.email), String(user.full_name), 'verify-email', {
      name: user.full_name,
      link: `${this.config.frontendUrl}/verify-email?token=${token}`,
      hours,
    })
  }

  async verify(token, req) {
    const userId = await this.verifications.consume(sha256(token))
    if (userId === null) throw ValidationError.withField('token', 'This verification link is invalid or has expired.')
    await this.users.markEmailVerified(userId)
    const user = (await this.users.find(userId)) ?? {}
    await this.audit.log('auth.email_verified', req, { actor: user, entity_type: 'user', entity_id: userId })
    return user
  }
}

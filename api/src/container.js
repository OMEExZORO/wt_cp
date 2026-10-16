import { Cookies } from './core/cookie.js'
import { DatabaseSessionStore, MemorySessionStore } from './core/session.js'
import { EmailVerification } from './models/email-verification.js'
import { LoginAttempt } from './models/login-attempt.js'
import { PasswordReset } from './models/password-reset.js'
import { Patient } from './models/patient.js'
import { RateLimit } from './models/rate-limit.js'
import { Referrer } from './models/referrer.js'
import { RememberToken } from './models/remember-token.js'
import { User } from './models/user.js'
import { AuthService } from './services/auth-service.js'
import { DatabaseAuditLogger } from './services/audit-logger.js'
import { EmailVerificationService } from './services/email-verification-service.js'
import { MailService } from './services/mail/mail-service.js'
import { createMailer } from './services/mail/mailers.js'
import { PasswordService } from './services/password-service.js'
import { RateLimiter } from './services/rate-limiter.js'
import { RegistrationService } from './services/registration-service.js'
import { RememberMeService } from './services/remember-me-service.js'
import { RequestValidator } from './validation/request-validator.js'

export const createContainer = ({ config, db, logger, mailer = null, sessionStore = null, audit = null }) => {
  const app = { config, db, logger }
  const modelOptions = { timezone: config.timezone }

  app.cookies = new Cookies(config)
  app.sessionStore =
    sessionStore ?? (config.session.store === 'memory' ? new MemorySessionStore() : new DatabaseSessionStore(db))

  app.models = {
    users: new User(db, modelOptions),
    patients: new Patient(db, modelOptions),
    referrers: new Referrer(db, modelOptions),
    loginAttempts: new LoginAttempt(db, modelOptions),
    passwordResets: new PasswordReset(db, modelOptions),
    emailVerifications: new EmailVerification(db, modelOptions),
    rateLimits: new RateLimit(db, modelOptions),
    rememberTokens: new RememberToken(db, modelOptions),
  }

  app.audit = audit ?? new DatabaseAuditLogger({ db, logger })
  app.limiter = new RateLimiter({ limits: app.models.rateLimits })
  app.mail = new MailService({
    mailer: mailer ?? createMailer(config),
    logger,
    globals: { clinic_name: config.mail.fromName, frontend_url: config.frontendUrl },
  })

  const requestValidator = new RequestValidator({ audit: app.audit, timezone: config.timezone })
  app.validate = (req, rules, messages = {}, input = null) => requestValidator.validate(req, rules, messages, input)

  const { users, patients, referrers } = app.models
  const remember = new RememberMeService({
    tokens: app.models.rememberTokens,
    users,
    cookies: app.cookies,
    config,
    audit: app.audit,
  })
  const auth = new AuthService({
    users,
    patients,
    referrers,
    attempts: app.models.loginAttempts,
    remember,
    audit: app.audit,
    config,
  })
  const verification = new EmailVerificationService({
    verifications: app.models.emailVerifications,
    users,
    mail: app.mail,
    audit: app.audit,
    config,
  })

  app.services = {
    remember,
    auth,
    verification,
    registration: new RegistrationService({ db, users, patients, referrers, auth, verification, audit: app.audit, config }),
    passwords: new PasswordService({
      users,
      resets: app.models.passwordResets,
      remember,
      auth,
      limiter: app.limiter,
      mail: app.mail,
      audit: app.audit,
      config,
    }),
  }

  return app
}

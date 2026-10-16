import { ConflictError } from '../core/errors.js'
import { sqlTimestamp } from '../core/time.js'
import { hashPassword } from './password-hasher.js'

const duplicate = () =>
  new ConflictError('An account with this email already exists.', {
    email: 'An account with this email already exists. Try signing in or resetting your password.',
  })

export class RegistrationService {
  constructor({ db, users, patients, referrers, auth, verification, audit, config }) {
    this.db = db
    this.users = users
    this.patients = patients
    this.referrers = referrers
    this.auth = auth
    this.verification = verification
    this.audit = audit
    this.config = config
  }

  async register(data, req) {
    if (await this.users.emailExists(data.email)) throw duplicate()

    const consentAt = sqlTimestamp(new Date(), this.config.timezone)
    const consentVersion = this.config.auth.consentVersion
    const role = data.account_type
    const passwordHash = await hashPassword(data.password)

    let user
    try {
      user = await this.db.tx(async (tx) => {
        const created = await this.users.using(tx).create({
          email: data.email,
          password_hash: passwordHash,
          role,
          full_name: data.full_name,
          phone: data.phone,
          password_changed_at: consentAt,
          consent_given_at: consentAt,
          consent_version: consentVersion,
        })
        if (role === 'patient') {
          await this.patients.using(tx).create({
            user_id: created.id,
            full_name: data.full_name,
            date_of_birth: data.date_of_birth ?? null,
            gender: data.gender ?? null,
            phone: data.phone,
            email: data.email,
            city: data.city ?? null,
            consent_given_at: consentAt,
            consent_version: consentVersion,
          })
        } else {
          await this.referrers.using(tx).create({
            user_id: created.id,
            full_name: data.full_name,
            qualification: data.qualification,
            registration_number: data.registration_number,
            clinic_name: data.clinic_name,
            phone: data.phone,
            city: data.city,
          })
        }
        return created
      })
    } catch (error) {
      if (error?.code === '23505') throw duplicate()
      throw error
    }

    await this.audit.log('auth.registered', req, {
      actor: user,
      entity_type: 'user',
      entity_id: user.id,
      metadata: { role, consent_version: consentVersion },
    })
    await this.verification.send(user)
    this.auth.startSession(req, user)
    return user
  }
}

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const CSRF_HEADER = 'X-CSRF-Token'
const SESSION_KEY = '_csrf_seed'

const safeEqual = (a, b) => {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

export class Csrf {
  constructor(session, secret) {
    this.session = session
    this.secret = secret
  }

  token() {
    let seed = this.session.get(SESSION_KEY)
    if (typeof seed !== 'string' || seed === '') {
      seed = randomBytes(32).toString('hex')
      this.session.set(SESSION_KEY, seed)
    }
    return this.sign(seed)
  }

  validate(token) {
    const seed = this.session.get(SESSION_KEY)
    if (typeof seed !== 'string' || seed === '' || token === null || token === undefined || token === '') return false
    return safeEqual(this.sign(seed), token)
  }

  rotate() {
    this.session.remove(SESSION_KEY)
    return this.token()
  }

  sign(seed) {
    if (!this.secret) throw new Error('Missing required environment variable CSRF_SECRET')
    return createHmac('sha256', this.secret).update(seed).digest('hex')
  }
}

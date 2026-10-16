import { createHash, randomBytes } from 'node:crypto'

const ID_PATTERN = /^[a-f0-9]{48}$/
const TOUCH_INTERVAL_SECONDS = 60

const hashId = (id) => createHash('sha256').update(id).digest('hex')
const nowSeconds = () => Math.floor(Date.now() / 1000)

export class MemorySessionStore {
  constructor() {
    this.records = new Map()
  }

  async load(id) {
    const record = this.records.get(hashId(id))
    if (!record || record.expiresAt <= nowSeconds()) return null
    return structuredClone(record.data)
  }

  async save(id, data, expiresAt) {
    this.records.set(hashId(id), { data: structuredClone(data), expiresAt })
  }

  async delete(id) {
    this.records.delete(hashId(id))
  }
}

export class DatabaseSessionStore {
  constructor(db) {
    this.db = db
  }

  async load(id) {
    const row = await this.db.one('SELECT data FROM http_sessions WHERE id = $1 AND expires_at > now()', [hashId(id)])
    return row ? row.data : null
  }

  async save(id, data, expiresAt) {
    await this.db.query(
      `INSERT INTO http_sessions (id, data, expires_at) VALUES ($1, $2::jsonb, to_timestamp($3))
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, expires_at = EXCLUDED.expires_at, updated_at = now()`,
      [hashId(id), JSON.stringify(data), expiresAt],
    )
    if (Math.random() < 0.01) await this.db.query('DELETE FROM http_sessions WHERE expires_at < now()').catch(() => {})
  }

  async delete(id) {
    await this.db.query('DELETE FROM http_sessions WHERE id = $1', [hashId(id)])
  }
}

export class Session {
  constructor({ store, config, cookies, req }) {
    this.store = store
    this.settings = config.session
    this.cookies = cookies
    this.req = req
    this.id = null
    this.data = {}
    this.previousId = null
    this.dirty = false
    this.issueCookie = false
    this.destroyed = false
    this.expired = false
  }

  get absoluteSeconds() {
    return Math.max(1, this.settings.absoluteHours) * 3600
  }

  get idleSeconds() {
    return this.settings.idleMinutes * 60
  }

  async start() {
    const cookieId = this.req.cookie(this.settings.name)
    if (cookieId === null || !ID_PATTERN.test(cookieId)) return
    const data = await this.store.load(cookieId)
    if (data === null) return
    this.id = cookieId
    this.data = data
    this.enforceLifetime()
  }

  enforceLifetime() {
    const now = nowSeconds()
    const lastActivity = Number.isInteger(this.data._last_activity) ? this.data._last_activity : null
    const createdAt = Number.isInteger(this.data._created_at) ? this.data._created_at : null
    const idleExpired = lastActivity !== null && now - lastActivity > this.idleSeconds
    const absoluteExpired = createdAt !== null && now - createdAt > this.absoluteSeconds
    if (idleExpired || absoluteExpired) {
      this.expired = 'user_id' in this.data
      this.data = {}
      this.rotateId()
      this.data._created_at = now
      this.data._last_activity = now
      this.dirty = true
      return
    }
    if (lastActivity === null || now - lastActivity >= TOUCH_INTERVAL_SECONDS) {
      this.data._last_activity = now
      this.dirty = true
    }
  }

  wasExpired() {
    return this.expired
  }

  isActive() {
    return this.id !== null
  }

  ensure() {
    if (this.id !== null) return
    const now = nowSeconds()
    this.id = randomBytes(24).toString('hex')
    this.data = { ...this.data, _created_at: now, _last_activity: now }
    this.issueCookie = true
    this.destroyed = false
  }

  rotateId() {
    if (this.id !== null && this.previousId === null) this.previousId = this.id
    this.id = randomBytes(24).toString('hex')
    this.issueCookie = true
    this.destroyed = false
  }

  get(key, fallback = null) {
    return this.data[key] ?? fallback
  }

  has(key) {
    return this.data[key] !== undefined && this.data[key] !== null
  }

  set(key, value) {
    this.ensure()
    this.data[key] = value
    this.dirty = true
  }

  remove(key) {
    if (!(key in this.data)) return
    delete this.data[key]
    this.dirty = true
  }

  regenerate() {
    const now = nowSeconds()
    if (this.id === null) {
      this.ensure()
    } else {
      this.rotateId()
    }
    this.data._created_at = now
    this.data._last_activity = now
    this.dirty = true
  }

  destroy() {
    if (this.id === null && this.previousId === null) return
    if (this.previousId === null) this.previousId = this.id
    this.id = null
    this.data = {}
    this.dirty = false
    this.destroyed = true
    this.cookies.forget(this.req, this.settings.name)
  }

  async commit() {
    if (this.previousId !== null) {
      await this.store.delete(this.previousId)
      this.previousId = null
    }
    if (this.id === null) return
    if (this.issueCookie) {
      this.cookies.sessionCookie(this.req, this.id)
      this.issueCookie = false
    }
    if (this.dirty) {
      await this.store.save(this.id, this.data, nowSeconds() + this.absoluteSeconds)
      this.dirty = false
    }
  }
}

import { createKernel } from '../../src/app.js'
import { buildConfig } from '../../src/core/config.js'
import { Db } from '../../src/core/database.js'
import { Logger } from '../../src/core/logger.js'
import { ApiRequest } from '../../src/core/request.js'
import { InMemoryAuditLogger } from '../../src/services/audit-logger.js'
import { InMemoryMailer } from '../../src/services/mail/mailers.js'

export class FakeDb extends Db {
  constructor() {
    super()
    this.handlers = []
    this.statements = []
  }

  on(needle, result) {
    this.handlers.unshift({ needle, result })
    return this
  }

  async query(sql, params = []) {
    this.statements.push({ sql, params })
    const handler = this.handlers.find((candidate) => sql.includes(candidate.needle))
    if (!handler) return { rows: [], rowCount: 0 }
    const value = typeof handler.result === 'function' ? handler.result(params, sql) : handler.result
    const rows = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value]
    return { rows, rowCount: rows.length }
  }

  async tx(work) {
    this.statements.push({ sql: 'BEGIN', params: [] })
    const result = await work(this)
    this.statements.push({ sql: 'COMMIT', params: [] })
    return result
  }

  ran(needle) {
    return this.statements.filter((statement) => statement.sql.includes(needle))
  }
}

export const TEST_ENV = {
  APP_ENV: 'development',
  CSRF_SECRET: 'test-csrf-secret',
  SESSION_STORE: 'memory',
  FRONTEND_URL: 'http://localhost:5173',
  APP_TIMEZONE: 'Asia/Kolkata',
}

export const makeApp = ({ db = new FakeDb(), env = {} } = {}) => {
  const audit = new InMemoryAuditLogger()
  const mailer = new InMemoryMailer()
  const config = buildConfig({ ...TEST_ENV, ...env })
  const app = createKernel({ config, db, logger: new Logger({ silent: true }), audit, mailer })
  return { app, db, audit, mailer, config }
}

export class Client {
  constructor(app, { origin = null, ip = '203.0.113.9' } = {}) {
    this.app = app
    this.origin = origin
    this.ip = ip
    this.jar = new Map()
    this.csrf = null
  }

  store(response) {
    for (const line of response.cookies) {
      const [pair] = line.split(';')
      const index = pair.indexOf('=')
      const name = pair.slice(0, index)
      const value = pair.slice(index + 1)
      if (value === 'deleted' || /expires=Thu, 01 Jan 1970/i.test(line)) this.jar.delete(name)
      else this.jar.set(name, value)
    }
  }

  async request(method, path, { json, headers = {}, query = {} } = {}) {
    const merged = { ...headers }
    if (this.origin) merged.origin = this.origin
    if (this.jar.size > 0) merged.cookie = [...this.jar].map(([name, value]) => `${name}=${value}`).join('; ')
    if (this.csrf && method !== 'GET') merged['x-csrf-token'] = this.csrf
    let rawBody = Buffer.alloc(0)
    if (json !== undefined) {
      merged['content-type'] = 'application/json'
      rawBody = Buffer.from(JSON.stringify(json))
    }
    const req = new ApiRequest({ method, path: `/api/v1${path}`, query, headers: merged, rawBody, cookies: parseJar(merged.cookie), ip: this.ip })
    const response = await this.app.kernel.handle(req)
    this.store(response)
    return { status: response.status, body: response.decoded(), response }
  }

  async refreshCsrf() {
    const { body } = await this.request('GET', '/auth/csrf')
    this.csrf = body.data.csrf_token
    return this.csrf
  }

  get(path, query) {
    return this.request('GET', path, { query })
  }

  async send(method, path, json) {
    await this.refreshCsrf()
    return this.request(method, path, { json })
  }

  post(path, json) {
    return this.send('POST', path, json)
  }
}

const parseJar = (header) =>
  Object.fromEntries(
    (header ?? '')
      .split('; ')
      .filter(Boolean)
      .map((pair) => {
        const index = pair.indexOf('=')
        return [pair.slice(0, index), pair.slice(index + 1)]
      }),
  )

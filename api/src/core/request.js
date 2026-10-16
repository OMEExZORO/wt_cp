import net from 'node:net'
import { BadRequestError } from './errors.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

const safeDecode = (value) => {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '))
  } catch {
    return value
  }
}

export const parseQuery = (search) => {
  const result = {}
  for (const [rawKey, value] of new URLSearchParams(search)) {
    if (rawKey.endsWith('[]')) {
      const key = rawKey.slice(0, -2)
      result[key] = [...(Array.isArray(result[key]) ? result[key] : []), value]
    } else {
      result[rawKey] = value
    }
  }
  return result
}

export const parseCookies = (header) => {
  const cookies = {}
  if (!header) return cookies
  for (const pair of header.split(';')) {
    const index = pair.indexOf('=')
    if (index < 1) continue
    const name = pair.slice(0, index).trim()
    if (!(name in cookies)) cookies[name] = safeDecode(pair.slice(index + 1).trim().replace(/^"|"$/g, ''))
  }
  return cookies
}

export class ApiRequest {
  constructor({ method = 'GET', path = '/', query = {}, headers = {}, rawBody = Buffer.alloc(0), cookies = {}, ip = null } = {}) {
    this.method = method.toUpperCase()
    this.rawPath = path
    this.queryParams = query
    this.headers = Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), String(value)]))
    this.rawBody = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody))
    this.cookies = cookies
    this.ipAddress = ip && net.isIP(ip) !== 0 ? ip : null
    this.attributes = {}
    this.parsedBody = null
    this.responseCookies = []
    this.routeParams = {}
    this.route = null
    this.user = null
    this.session = null
    this.csrf = null
    this.sessionExpired = false
  }

  static fromNode(req, { trustProxy = false } = {}) {
    const url = new URL(req.originalUrl ?? req.url, 'http://localhost')
    let ip = req.socket?.remoteAddress ?? null
    if (ip?.startsWith('::ffff:')) ip = ip.slice(7)
    const forwarded = req.headers['x-forwarded-for']
    if (trustProxy && forwarded) {
      const first = String(forwarded).split(',')[0].trim()
      if (first) ip = first
    }
    return new ApiRequest({
      method: req.method,
      path: url.pathname,
      query: parseQuery(url.search),
      headers: req.headers,
      rawBody: Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0),
      cookies: parseCookies(req.headers.cookie),
      ip,
    })
  }

  get path() {
    const trimmed = this.rawPath.replace(/\/+$/, '')
    return trimmed === '' ? '/' : trimmed
  }

  isMethodSafe() {
    return SAFE_METHODS.has(this.method)
  }

  header(name, fallback = null) {
    return this.headers[name.toLowerCase()] ?? fallback
  }

  query(key = null, fallback = null) {
    if (key === null) return this.queryParams
    return this.queryParams[key] ?? fallback
  }

  cookie(name) {
    const value = this.cookies[name]
    return typeof value === 'string' ? value : null
  }

  get ip() {
    return this.ipAddress
  }

  get userAgent() {
    const agent = this.header('user-agent')
    return agent === null ? null : [...agent].slice(0, 500).join('')
  }

  body() {
    if (this.parsedBody !== null) return this.parsedBody
    const contentType = this.header('content-type', '').toLowerCase()
    if (contentType.includes('application/json')) {
      const text = this.rawBody.toString('utf8')
      if (text.trim() === '') return (this.parsedBody = {})
      let decoded
      try {
        decoded = JSON.parse(text)
      } catch {
        throw new BadRequestError('The request body is not valid JSON.')
      }
      if (decoded === null || typeof decoded !== 'object') {
        throw new BadRequestError('The request body must be a JSON object.')
      }
      return (this.parsedBody = decoded)
    }
    if (contentType.includes('application/x-www-form-urlencoded')) {
      return (this.parsedBody = parseQuery(this.rawBody.toString('utf8')))
    }
    return (this.parsedBody = {})
  }

  input(key, fallback = null) {
    return this.body()[key] ?? fallback
  }

  all() {
    return { ...this.queryParams, ...this.body() }
  }

  param(key, fallback = null) {
    return this.routeParams[key] ?? fallback
  }

  setCookie(line) {
    this.responseCookies.push(line)
  }
}

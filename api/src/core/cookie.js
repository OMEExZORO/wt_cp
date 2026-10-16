const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const httpDate = (epochSeconds) => {
  const d = new Date(epochSeconds * 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${DAY_NAMES[d.getUTCDay()]}, ${pad(d.getUTCDate())} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} GMT`
}

export const serializeCookie = (name, value, { expiresAt = 0, httpOnly = true, session }) => {
  const parts = []
  if (value === '') {
    parts.push(`${name}=deleted`, 'expires=Thu, 01 Jan 1970 00:00:01 GMT', 'Max-Age=0')
  } else {
    parts.push(`${name}=${encodeURIComponent(value)}`)
    if (expiresAt > 0) {
      const now = Math.floor(Date.now() / 1000)
      parts.push(`expires=${httpDate(expiresAt)}`, `Max-Age=${Math.max(0, expiresAt - now)}`)
    }
  }
  parts.push('path=/')
  if (session.domain) parts.push(`domain=${session.domain}`)
  if (session.secure) parts.push('secure')
  if (httpOnly) parts.push('HttpOnly')
  parts.push(`SameSite=${session.sameSite}`)
  return parts.join('; ')
}

export class Cookies {
  constructor(config) {
    this.session = config.session
  }

  set(req, name, value, expiresAt, httpOnly = true) {
    req.setCookie(serializeCookie(name, value, { expiresAt, httpOnly, session: this.session }))
  }

  sessionCookie(req, id) {
    req.setCookie(serializeCookie(this.session.name, id, { expiresAt: 0, httpOnly: true, session: this.session }))
  }

  forget(req, name) {
    this.set(req, name, '', 0)
  }
}

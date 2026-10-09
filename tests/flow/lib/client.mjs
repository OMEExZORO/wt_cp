export class Client {
  constructor(base) {
    this.base = base
    this.jar = new Map()
    this.csrf = null
  }

  storeCookies(res) {
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';')
      const index = pair.indexOf('=')
      const name = pair.slice(0, index).trim()
      const value = pair.slice(index + 1).trim()
      if (value === '' || /expires=Thu, 01 Jan 1970/i.test(line)) this.jar.delete(name)
      else this.jar.set(name, value)
    }
  }

  cookieHeader() {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ')
  }

  async refreshCsrf() {
    const res = await this.raw('GET', '/auth/csrf')
    this.csrf = res.json.data.csrf_token
    return this.csrf
  }

  async raw(method, path, { json, form, headers = {}, query } = {}) {
    const url = new URL(this.base + path)
    if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
    const init = { method, headers: { Accept: 'application/json', ...headers }, redirect: 'manual' }
    const cookie = this.cookieHeader()
    if (cookie) init.headers.Cookie = cookie
    if (this.csrf && method !== 'GET') init.headers['X-CSRF-Token'] = this.csrf
    if (json !== undefined) {
      init.headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(json)
    } else if (form) {
      init.body = form
    }
    const res = await fetch(url, init)
    this.storeCookies(res)
    const buffer = Buffer.from(await res.arrayBuffer())
    let parsed = null
    if ((res.headers.get('content-type') ?? '').includes('json')) {
      try {
        parsed = JSON.parse(buffer.toString('utf8'))
      } catch {
        parsed = null
      }
    }
    return { status: res.status, headers: res.headers, json: parsed, buffer }
  }

  async call(method, path, options = {}) {
    if (method !== 'GET') await this.refreshCsrf()
    return this.raw(method, path, options)
  }

  get(path, query) {
    return this.call('GET', path, { query })
  }

  post(path, json) {
    return this.call('POST', path, { json })
  }

  patch(path, json) {
    return this.call('PATCH', path, { json })
  }

  put(path, json) {
    return this.call('PUT', path, { json })
  }

  del(path) {
    return this.call('DELETE', path)
  }

  postForm(path, form) {
    return this.call('POST', path, { form })
  }

  async login(email, password) {
    await this.refreshCsrf()
    const res = await this.raw('POST', '/auth/login', { json: { email, password } })
    return res
  }
}

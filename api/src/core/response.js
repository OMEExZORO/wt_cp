export class ApiResponse {
  constructor(body = '', status = 200, headers = {}) {
    this.body = body
    this.status = status
    this.headers = new Map()
    this.cookies = []
    for (const [name, value] of Object.entries(headers)) this.setHeader(name, value)
  }

  static json(data, status = 200, meta = {}) {
    const body = { data, error: null }
    if (Object.keys(meta).length > 0) body.meta = meta
    return ApiResponse.encode(body, status)
  }

  static error(code, message, status = 400, fields = {}, extra = {}) {
    const error = { code, message }
    if (Object.keys(fields).length > 0) error.fields = fields
    Object.assign(error, extra)
    return ApiResponse.encode({ data: null, error }, status)
  }

  static noContent() {
    return new ApiResponse('', 204)
  }

  static binary(buffer, status = 200, headers = {}) {
    return new ApiResponse(buffer, status, headers)
  }

  static encode(body, status) {
    return new ApiResponse(JSON.stringify(body), status, { 'Content-Type': 'application/json; charset=utf-8' })
  }

  setHeader(name, value) {
    this.headers.set(name.toLowerCase(), [name, String(value)])
    return this
  }

  header(name) {
    return this.headers.get(name.toLowerCase())?.[1] ?? null
  }

  addCookie(line) {
    this.cookies.push(line)
    return this
  }

  decoded() {
    try {
      const decoded = JSON.parse(this.body)
      return decoded !== null && typeof decoded === 'object' ? decoded : null
    } catch {
      return null
    }
  }

  send(res) {
    res.status(this.status)
    for (const [name, value] of this.headers.values()) res.setHeader(name, value)
    if (this.cookies.length > 0) res.setHeader('Set-Cookie', this.cookies)
    if (this.status === 204) {
      res.end()
      return
    }
    res.end(this.body)
  }
}

export const ok = (data, status = 200, meta = {}) => ApiResponse.json(data, status, meta)
export const created = (data) => ApiResponse.json(data, 201)
export const message = (text, status = 200) => ApiResponse.json({ message: text }, status)
export const noContent = () => ApiResponse.noContent()

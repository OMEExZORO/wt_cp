import { ApiRequest } from '../../src/core/request.js'

export const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n')

export const multipart = async (fields, file = null) => {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) form.append(name, value)
  if (file) form.append(file.field ?? 'file', new File([file.buffer], file.name, { type: file.type ?? 'application/octet-stream' }), file.name)
  const response = new Response(form)
  return { body: Buffer.from(await response.arrayBuffer()), type: response.headers.get('content-type') }
}

export const makeRequest = async ({ method = 'POST', path = '/api/v1/reports', user = null, fields = null, file = null, params = {}, headers = {}, json } = {}) => {
  const merged = { ...headers }
  let rawBody = Buffer.alloc(0)
  if (fields !== null) {
    const built = await multipart(fields, file)
    rawBody = built.body
    merged['content-type'] = built.type
  } else if (json !== undefined) {
    merged['content-type'] = 'application/json'
    rawBody = Buffer.from(JSON.stringify(json))
  }
  const req = new ApiRequest({ method, path, headers: merged, rawBody, ip: '203.0.113.9' })
  req.user = user
  req.routeParams = params
  return req
}

export class MemoryStorage {
  constructor() {
    this.objects = new Map()
  }

  async put(path, contents) {
    this.objects.set(path, Buffer.from(contents))
  }

  async get(path) {
    if (!this.objects.has(path)) throw new Error('missing')
    return Buffer.from(this.objects.get(path))
  }

  async delete(path) {
    this.objects.delete(path)
  }

  driver() {
    return 'local'
  }
}

import { StorageError } from '../../core/errors.js'
import { assertValidPath } from './storage-service.js'

export class SupabaseStorage {
  constructor({ baseUrl, serviceKey, bucket, timeoutSeconds = 60, fetchImpl = fetch }) {
    this.baseUrl = baseUrl
    this.serviceKey = serviceKey
    this.bucket = bucket
    this.timeoutSeconds = timeoutSeconds
    this.fetch = fetchImpl
  }

  async put(path, contents) {
    const { status } = await this.request('POST', path, contents, {
      'Content-Type': 'application/octet-stream',
      'x-upsert': 'false',
    })
    if (status !== 200 && status !== 201) throw new StorageError(`Storage upload failed (HTTP ${status}).`)
  }

  async get(path) {
    const { status, body } = await this.request('GET', path)
    if (status !== 200) throw new StorageError(`Storage download failed (HTTP ${status}).`)
    return body
  }

  async delete(path) {
    const { status } = await this.request('DELETE', path)
    if (status !== 200 && status !== 204 && status !== 404) throw new StorageError(`Storage delete failed (HTTP ${status}).`)
  }

  driver() {
    return 'supabase'
  }

  async request(method, path, body = null, headers = {}) {
    assertValidPath(path)
    const url = `${this.baseUrl.replace(/\/+$/, '')}/storage/v1/object/${encodeURIComponent(this.bucket)}/${path}`
    try {
      const response = await this.fetch(url, {
        method,
        body: body ?? undefined,
        headers: { Authorization: `Bearer ${this.serviceKey}`, apikey: this.serviceKey, ...headers },
        signal: AbortSignal.timeout(this.timeoutSeconds * 1000),
      })
      return { status: response.status, body: Buffer.from(await response.arrayBuffer()) }
    } catch {
      throw new StorageError('Storage is unreachable.')
    }
  }
}

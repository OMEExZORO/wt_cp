import { randomBytes } from 'node:crypto'
import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PayloadTooLargeError, ValidationError } from '../../core/errors.js'
import { imageSize, sniffMime } from '../uploads.js'

export const MAX_BYTES = 2097152
export const MIN_DIMENSION = 200
export const MAX_DIMENSION = 6000
export const MIME_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

const TOO_LARGE = 'The image is larger than the 2 MB limit.'

export class ImageUploadStore {
  constructor(directory) {
    this.directory = directory
  }

  async save(file, field = 'photo') {
    if (!file || (file.name === '' && file.buffer.length === 0 && !file.truncated)) {
      throw ValidationError.withField(field, 'Choose an image file to upload.')
    }
    if (file.truncated) throw new PayloadTooLargeError(TOO_LARGE)
    const size = file.buffer.length
    if (size < 1) throw ValidationError.withField(field, 'The image is empty.')
    if (size > MAX_BYTES) throw new PayloadTooLargeError(TOO_LARGE)

    const mime = sniffMime(file.buffer)
    if (mime === null || !(mime in MIME_EXTENSIONS)) {
      throw ValidationError.withField(field, 'Only JPEG, PNG or WebP images are accepted.')
    }
    const dimensions = imageSize(file.buffer, mime)
    if (
      dimensions === null ||
      dimensions.width < MIN_DIMENSION ||
      dimensions.height < MIN_DIMENSION ||
      dimensions.width > MAX_DIMENSION ||
      dimensions.height > MAX_DIMENSION
    ) {
      throw ValidationError.withField(field, 'The image must be between 200 and 6000 pixels on each side.')
    }

    await mkdir(this.directory, { recursive: true, mode: 0o750 })
    const name = `${randomBytes(16).toString('hex')}.${MIME_EXTENSIONS[mime]}`
    await writeFile(path.join(this.directory, name), file.buffer, { mode: 0o640 })
    await this.removeExcept(name)
    return { name, mime, bytes: size }
  }

  async current() {
    let latest = null
    for (const name of await this.files()) {
      const full = path.join(this.directory, name)
      const { mtimeMs } = await stat(full)
      if (latest === null || mtimeMs > latest.mtimeMs) latest = { full, mtimeMs }
    }
    if (latest === null) return null
    const body = await readFile(latest.full)
    const mime = sniffMime(body)
    return mime !== null && mime in MIME_EXTENSIONS ? { path: latest.full, mime, body } : null
  }

  async clear() {
    await this.removeExcept('')
  }

  async files() {
    try {
      return (await readdir(this.directory)).filter((name) => /\.(jpg|png|webp)$/.test(name))
    } catch {
      return []
    }
  }

  async removeExcept(keep) {
    for (const name of await this.files()) {
      if (name !== keep) await unlink(path.join(this.directory, name)).catch(() => {})
    }
  }
}

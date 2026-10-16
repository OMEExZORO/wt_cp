import { PayloadTooLargeError, ValidationError } from '../../core/errors.js'
import { sniffMime } from '../uploads.js'

export const MAX_BYTES = 10485760
export const TYPES = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
}

const DANGEROUS_SEGMENT = /\.(php\d?|phtml|phar|pl|py|rb|cgi|asp|aspx|jsp|exe|dll|com|bat|cmd|sh|bash|ps1|vbs|js|mjs|html?|svg|swf|jar)(\.|$)/i

export const cleanName = (name) => {
  let value = String(name).replaceAll('\\', '/').replace(/\/+$/, '')
  value = value.slice(value.lastIndexOf('/') + 1)
  value = value.replace(/[^A-Za-z0-9._ -]+/g, '_')
  value = value.replace(/\s+/g, ' ').replace(/^[ .]+|[ .]+$/g, '')
  return [...value].slice(0, 100).join('')
}

export class UploadedFileValidator {
  constructor(maxBytes = MAX_BYTES) {
    this.maxBytes = maxBytes
  }

  tooLargeMessage() {
    return `The file is too large. The limit is ${Math.floor(this.maxBytes / 1048576)} MB.`
  }

  tooLarge() {
    return new PayloadTooLargeError(this.tooLargeMessage(), { file: this.tooLargeMessage() })
  }

  validate(file) {
    if (!file || (file.name === '' && file.buffer.length === 0 && !file.truncated)) {
      throw ValidationError.withField('file', 'Choose a file to upload.')
    }
    if (file.truncated) throw this.tooLarge()
    const size = file.buffer.length
    if (size <= 0) throw ValidationError.withField('file', 'The file is empty.')
    if (size > this.maxBytes) throw this.tooLarge()

    const originalName = cleanName(file.name ?? '')
    if (originalName === '' || DANGEROUS_SEGMENT.test(originalName)) {
      throw ValidationError.withField('file', 'This file name is not allowed.')
    }
    const dot = originalName.lastIndexOf('.')
    const extension = dot > 0 ? originalName.slice(dot + 1).toLowerCase() : ''

    const mime = sniffMime(file.buffer)
    if (mime === null || !(mime in TYPES)) {
      throw ValidationError.withField('file', 'Only PDF, JPG and PNG files are allowed.')
    }
    if (!TYPES[mime].includes(extension)) {
      throw ValidationError.withField('file', 'The file extension does not match the file contents.')
    }
    return { buffer: file.buffer, mime_type: mime, extension, size_bytes: size, original_name: originalName }
  }
}

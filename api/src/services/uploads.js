import busboy from 'busboy'

export const parseMultipart = (req, { maxFileBytes }) => {
  const contentType = req.header('content-type', '')
  if (!/^multipart\/form-data/i.test(contentType)) return Promise.resolve({ fields: req.body(), files: {} })

  return new Promise((resolve) => {
    const fields = {}
    const files = {}
    let parser
    try {
      parser = busboy({ headers: { 'content-type': contentType }, limits: { fileSize: maxFileBytes, files: 5, fields: 50, parts: 60 } })
    } catch {
      resolve({ fields: {}, files: {} })
      return
    }
    parser.on('field', (name, value) => {
      if (!name.endsWith('[]') && !(name in fields)) fields[name] = value
    })
    parser.on('file', (name, stream, info) => {
      const chunks = []
      const file = { name: info.filename ?? '', mimeType: info.mimeType, buffer: Buffer.alloc(0), truncated: false }
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('limit', () => {
        file.truncated = true
      })
      stream.on('close', () => {
        file.buffer = Buffer.concat(chunks)
        if (!(name in files)) files[name] = file
      })
    })
    parser.on('error', () => resolve({ fields, files }))
    parser.on('close', () => resolve({ fields, files }))
    parser.end(req.rawBody)
  })
}

export const sniffMime = (buffer) => {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf'
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') {
    return 'image/webp'
  }
  return null
}

export const imageSize = (buffer, mime) => {
  try {
    if (mime === 'image/png') {
      if (buffer.length < 24 || buffer.subarray(12, 16).toString('latin1') !== 'IHDR') return null
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
    }
    if (mime === 'image/jpeg') {
      let offset = 2
      while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xff) {
          offset += 1
          continue
        }
        const marker = buffer[offset + 1]
        if (marker === 0xff) {
          offset += 1
          continue
        }
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
          offset += 2
          continue
        }
        const length = buffer.readUInt16BE(offset + 2)
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) }
        }
        offset += 2 + length
      }
      return null
    }
    if (mime === 'image/webp') {
      const kind = buffer.subarray(12, 16).toString('latin1')
      if (kind === 'VP8X') return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) }
      if (kind === 'VP8 ') return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff }
      if (kind === 'VP8L') {
        const bits = buffer.readUInt32LE(21)
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
      }
    }
  } catch {
    return null
  }
  return null
}

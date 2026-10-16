import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { EncryptionError } from '../core/errors.js'
import { envInt, requireEnv } from '../core/env.js'

const CIPHER = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16
const ENVELOPE_PREFIX = 'dc'

const parseKey = (key) => {
  if (!key.startsWith('base64:')) throw new EncryptionError('Encryption key must start with base64:.')
  const raw = Buffer.from(key.slice(7), 'base64')
  if (raw.length !== 32) throw new EncryptionError('Encryption key must be 32 bytes, base64 encoded.')
  return raw
}

const decodeBase64 = (text) => {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text)) throw new EncryptionError('Malformed encrypted payload.')
  return Buffer.from(text, 'base64')
}

export class EncryptionService {
  constructor(currentKey, currentVersion = 1, previousKeys = {}) {
    if (currentVersion < 1 || currentVersion > 32767) throw new EncryptionError('Invalid encryption key version.')
    this.currentVersion = currentVersion
    this.keys = new Map([[currentVersion, parseKey(currentKey)]])
    for (const [version, key] of Object.entries(previousKeys)) {
      const number = Number(version)
      if (number < 1 || number === currentVersion) throw new EncryptionError('Invalid previous encryption key version.')
      this.keys.set(number, parseKey(String(key)))
    }
  }

  static fromEnv(source = process.env) {
    const previous = {}
    const pairs = (source.ENCRYPTION_KEYS_PREVIOUS ?? '').split(',').map((pair) => pair.trim()).filter(Boolean)
    for (const pair of pairs) {
      const index = pair.indexOf('=')
      const version = pair.slice(0, index)
      if (index < 1 || !/^\d+$/.test(version)) {
        throw new EncryptionError('ENCRYPTION_KEYS_PREVIOUS must look like 1=base64:...,2=base64:...')
      }
      previous[Number(version)] = pair.slice(index + 1)
    }
    return new EncryptionService(requireEnv('ENCRYPTION_KEY', source), envInt('ENCRYPTION_KEY_VERSION', 1, source), previous)
  }

  static generateKey() {
    return `base64:${randomBytes(32).toString('base64')}`
  }

  hasVersion(version) {
    return this.keys.has(version)
  }

  encrypt(plaintext, aad = Buffer.alloc(0)) {
    const iv = randomBytes(IV_BYTES)
    const cipher = createCipheriv(CIPHER, this.keys.get(this.currentVersion), iv, { authTagLength: TAG_BYTES })
    if (aad.length > 0) cipher.setAAD(Buffer.from(aad))
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
    return { ciphertext, iv, tag: cipher.getAuthTag(), keyVersion: this.currentVersion }
  }

  decrypt(ciphertext, iv, tag, keyVersion, aad = Buffer.alloc(0)) {
    const key = this.keys.get(keyVersion)
    if (!key) throw new EncryptionError('Unknown encryption key version.')
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new EncryptionError('Malformed encrypted payload.')
    try {
      const decipher = createDecipheriv(CIPHER, key, iv, { authTagLength: TAG_BYTES })
      if (aad.length > 0) decipher.setAAD(Buffer.from(aad))
      decipher.setAuthTag(tag)
      return Buffer.concat([decipher.update(ciphertext), decipher.final()])
    } catch {
      throw new EncryptionError('Decryption failed: data was altered or the key is wrong.')
    }
  }

  encryptText(plaintext) {
    const sealed = this.encrypt(Buffer.from(plaintext, 'utf8'))
    return [
      ENVELOPE_PREFIX,
      `v${sealed.keyVersion}`,
      sealed.iv.toString('base64'),
      sealed.tag.toString('base64'),
      sealed.ciphertext.toString('base64'),
    ].join(':')
  }

  decryptText(envelope) {
    const parts = envelope.split(':')
    const version = /^v(\d+)$/.exec(parts[1] ?? '')
    if (parts.length !== 5 || parts[0] !== ENVELOPE_PREFIX || version === null) {
      throw new EncryptionError('Malformed encrypted payload.')
    }
    return this.decrypt(decodeBase64(parts[4]), decodeBase64(parts[2]), decodeBase64(parts[3]), Number(version[1])).toString('utf8')
  }

  encryptNullable(plaintext) {
    return plaintext === null || plaintext === undefined || plaintext === '' ? null : this.encryptText(plaintext)
  }

  decryptNullable(envelope) {
    return envelope === null || envelope === undefined || envelope === '' ? null : this.decryptText(envelope)
  }

  envelopeVersion(envelope) {
    const match = /^dc:v(\d+):/.exec(envelope)
    return match === null ? null : Number(match[1])
  }
}

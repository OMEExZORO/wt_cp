import { randomBytes, timingSafeEqual } from 'node:crypto'
import argon2 from 'argon2'

export const ARGON_PARAMS = { memoryCost: 65536, timeCost: 4, parallelism: 1 }
const HASH_LENGTH = 32
const SALT_LENGTH = 16

const encode = (buffer) => buffer.toString('base64').replace(/=+$/, '')

const parse = (hash) => {
  const match = /^\$argon2id\$v=(\d+)\$([^$]+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(hash)
  if (!match) return null
  const params = Object.fromEntries(match[2].split(',').map((pair) => pair.split('=')))
  const memoryCost = Number(params.m)
  const timeCost = Number(params.t)
  const parallelism = Number(params.p)
  if (![memoryCost, timeCost, parallelism].every(Number.isInteger)) return null
  return {
    version: Number(match[1]),
    memoryCost,
    timeCost,
    parallelism,
    salt: Buffer.from(match[3], 'base64'),
    digest: Buffer.from(match[4], 'base64'),
  }
}

const derive = (password, { salt, memoryCost, timeCost, parallelism, digest }) =>
  argon2.hash(password, {
    type: argon2.argon2id,
    raw: true,
    salt,
    memoryCost,
    timeCost,
    parallelism,
    hashLength: digest?.length ?? HASH_LENGTH,
  })

export const hashPassword = async (password) => {
  const salt = randomBytes(SALT_LENGTH)
  const digest = await derive(password, { salt, ...ARGON_PARAMS })
  const { memoryCost, timeCost, parallelism } = ARGON_PARAMS
  return `$argon2id$v=19$m=${memoryCost},t=${timeCost},p=${parallelism}$${encode(salt)}$${encode(digest)}`
}

export const verifyPassword = async (password, hash) => {
  const parsed = typeof hash === 'string' ? parse(hash) : null
  if (parsed === null) return false
  try {
    const candidate = await derive(password, parsed)
    return candidate.length === parsed.digest.length && timingSafeEqual(candidate, parsed.digest)
  } catch {
    return false
  }
}

export const needsRehash = (hash) => {
  const parsed = typeof hash === 'string' ? parse(hash) : null
  return (
    parsed === null ||
    parsed.memoryCost !== ARGON_PARAMS.memoryCost ||
    parsed.timeCost !== ARGON_PARAMS.timeCost ||
    parsed.parallelism !== ARGON_PARAMS.parallelism
  )
}

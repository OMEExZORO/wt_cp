import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

export const loadEnvFiles = (...paths) => {
  for (const path of paths) {
    if (!existsSync(path)) continue
    for (const [key, value] of Object.entries(parseEnv(readFileSync(path, 'utf8')))) {
      if (process.env[key] === undefined) process.env[key] = value
    }
  }
}

export const envString = (key, fallback = null, source = process.env) => {
  const value = source[key]
  return value === undefined || value === null || value === '' ? fallback : String(value)
}

export const requireEnv = (key, source = process.env) => {
  const value = envString(key, null, source)
  if (value === null) throw new Error(`Missing required environment variable ${key}`)
  return value
}

export const envBool = (key, fallback = false, source = process.env) => {
  const value = envString(key, null, source)
  return value === null ? fallback : ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

export const envInt = (key, fallback = 0, source = process.env) => {
  const value = envString(key, null, source)
  return value === null || value.trim() === '' || Number.isNaN(Number(value)) ? fallback : Math.trunc(Number(value))
}

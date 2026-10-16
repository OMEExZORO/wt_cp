import { randomInt } from 'node:crypto'
import { zonedDate } from '../../core/time.js'

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export const REFERENCE_PATTERN = /^MDC-\d{6}-[A-HJ-NP-Z2-9]{5}$/

export const generateReference = (date = new Date(), timezone = 'Asia/Kolkata') => {
  let suffix = ''
  for (let i = 0; i < 5; i += 1) suffix += ALPHABET[randomInt(0, ALPHABET.length)]
  return `MDC-${zonedDate(date, timezone).slice(2).replaceAll('-', '')}-${suffix}`
}

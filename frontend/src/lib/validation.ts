export type FormValue = string | boolean

export type FieldValidator = (value: FormValue, values: Record<string, FormValue>) => string | null

export const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u
export const PHONE_PATTERN = /^(?:\+91)?[6-9]\d{9}$/
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/
export const EMAIL_DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i
export const REGISTRATION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/\-. ]{2,29}$/
export const TOKEN_PATTERN = /^[a-f0-9]{64}$/
export const PASSWORD_MIN = 10
export const PASSWORD_MAX = 128
export const DEFAULT_MAX_LENGTH = 255

export const MESSAGES = {
  required: 'This field is required.',
  unsafe: 'This field contains characters or patterns that are not allowed.',
  name: 'Use letters, spaces, apostrophes, dots and hyphens only.',
  email: 'Enter a valid email address.',
  phone: 'Enter a valid 10 digit Indian mobile number.',
  password: 'Include upper and lower case letters, a number and a symbol.',
  confirm: 'The values do not match.',
  date: 'Enter a valid date (YYYY-MM-DD).',
  pastDate: 'The date must be before today.',
  registration: 'Use 3 to 30 letters, digits, spaces, dots, slashes or hyphens.',
  token: 'This link is invalid or has expired.',
  accepted: 'You must accept this to continue.',
}

const SQL_PATTERNS: RegExp[] = [
  /'\s*(?:or|and)\s+'?[\w\s]*'?\s*(?:=|<|>|like\b)/i,
  /\b(?:or|and)\s+'?\d+'?\s*=\s*'?\d+/i,
  /'\s*(?:;|--|#|\/\*)/,
  /;\s*(?:--|#|\/\*)/,
  /\b(?:drop|truncate|alter|create)\s+(?:table|database|schema|user|role|function|view)\b/i,
  /\bunion\b(?:\s+all|\s+distinct)?\s+select\b/i,
  /\binsert\s+into\b/i,
  /\bdelete\s+from\b/i,
  /\bupdate\s+\w+\s+set\b/i,
  /\bselect\b[\s\S]{0,80}\bfrom\s+(?:users|pg_\w+|information_schema)\b/i,
  /\b(?:pg_sleep|benchmark)\s*\(/i,
  /\bsleep\s*\(\s*\d+\s*\)/i,
  /\bwaitfor\s+delay\b/i,
  /\bexec(?:ute)?\s+(?:xp_|sp_)\w+/i,
  /\b(?:information_schema|pg_catalog|pg_shadow)\b/i,
  /\/\*[\s\S]*?\*\//,
]

const HTML_PATTERNS: RegExp[] = [
  /<\s*\/?\s*[a-z!?]/i,
  /\b(?:javascript|vbscript|livescript)\s*:/i,
  /\bdata\s*:\s*text\/html/i,
  /\bon[a-z]{3,}\s*=/i,
  /&#x?[0-9a-f]+;?/i,
  /\bexpression\s*\(/i,
]

export function normalise(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function detectThreat(value: string): 'sqli' | 'xss' | null {
  let decoded = value
  try {
    decoded = decodeURIComponent(value)
  } catch {
    decoded = value
  }
  for (const candidate of [value, decoded]) {
    if (HTML_PATTERNS.some((pattern) => pattern.test(candidate))) {
      return 'xss'
    }
    if (SQL_PATTERNS.some((pattern) => pattern.test(candidate))) {
      return 'sqli'
    }
  }
  return null
}

export function passwordProblem(password: string): string | null {
  const length = [...password].length
  if (length < PASSWORD_MIN) {
    return `Use at least ${PASSWORD_MIN} characters.`
  }
  if (length > PASSWORD_MAX) {
    return `Use at most ${PASSWORD_MAX} characters.`
  }
  if (!/\p{Ll}/u.test(password) || !/\p{Lu}/u.test(password) || !/\d/.test(password) || !/[^\p{L}\d]/u.test(password)) {
    return MESSAGES.password
  }
  return null
}

export function normalisePhone(value: string): string {
  return value.replace(/[\s\-()]/g, '')
}

function text(value: FormValue): string {
  return typeof value === 'string' ? normalise(value) : ''
}

function isBlank(value: FormValue): boolean {
  return typeof value === 'string' ? normalise(value) === '' : value === false
}

export const rules = {
  required:
    (message: string = MESSAGES.required): FieldValidator =>
    (value) =>
      isBlank(value) ? message : null,
  accepted:
    (message: string = MESSAGES.accepted): FieldValidator =>
    (value) =>
      value === true ? null : message,
  safe: (): FieldValidator => (value) => (typeof value === 'string' && detectThreat(value) !== null ? MESSAGES.unsafe : null),
  minLength:
    (min: number): FieldValidator =>
    (value) =>
      !isBlank(value) && [...text(value)].length < min ? `Must be at least ${min} characters.` : null,
  maxLength:
    (max: number = DEFAULT_MAX_LENGTH): FieldValidator =>
    (value) =>
      [...text(value)].length > max ? `Must be at most ${max} characters.` : null,
  name: (): FieldValidator => (value) => (!isBlank(value) && !NAME_PATTERN.test(text(value)) ? MESSAGES.name : null),
  email: (): FieldValidator => (value) => {
    if (isBlank(value)) {
      return null
    }
    const email = text(value).toLowerCase()
    const domain = email.split('@')[1] ?? ''
    return email.length <= 254 && EMAIL_PATTERN.test(email) && EMAIL_DOMAIN_PATTERN.test(domain) ? null : MESSAGES.email
  },
  phone: (): FieldValidator => (value) => (!isBlank(value) && !PHONE_PATTERN.test(normalisePhone(text(value))) ? MESSAGES.phone : null),
  password: (): FieldValidator => (value) => (typeof value === 'string' && value !== '' ? passwordProblem(value) : null),
  matches:
    (field: string, message: string = MESSAGES.confirm): FieldValidator =>
    (value, values) =>
      value !== '' && value !== values[field] ? message : null,
  pastDate: (): FieldValidator => (value) => {
    if (isBlank(value)) {
      return null
    }
    const raw = text(value)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`)) || new Date(`${raw}T00:00:00Z`).toISOString().slice(0, 10) !== raw) {
      return MESSAGES.date
    }
    const today = new Date()
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    return raw < todayString && raw > '1900-01-01' ? null : MESSAGES.pastDate
  },
  registrationNumber: (): FieldValidator => (value) =>
    !isBlank(value) && !REGISTRATION_PATTERN.test(text(value)) ? MESSAGES.registration : null,
  oneOf:
    (options: readonly string[]): FieldValidator =>
    (value) =>
      typeof value === 'string' && value !== '' && !options.includes(value) ? 'Choose one of the allowed options.' : null,
}

export function compose(...validators: FieldValidator[]): FieldValidator {
  return (value, values) => {
    for (const validator of validators) {
      const message = validator(value, values)
      if (message !== null) {
        return message
      }
    }
    return null
  }
}

export const fieldRules = {
  fullName: compose(rules.required(), rules.safe(), rules.minLength(2), rules.maxLength(120), rules.name()),
  email: compose(rules.required(), rules.safe(), rules.maxLength(254), rules.email()),
  phone: compose(rules.required(), rules.safe(), rules.phone()),
  newPassword: compose(rules.required(), rules.password()),
  loginPassword: compose(rules.required(), rules.maxLength(PASSWORD_MAX)),
  city: compose(rules.safe(), rules.minLength(2), rules.maxLength(80)),
}

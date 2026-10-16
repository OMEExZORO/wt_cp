import { ValidationError } from '../core/errors.js'
import { zonedDate } from '../core/time.js'
import { clean, detectThreat } from './sanitizer.js'

export const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'\-]*$/u
export const PHONE_PATTERN = /^(?:\+91)?[6-9]\d{9}$/
export const EMAIL_DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/
export const TOKEN_PATTERN = /^[a-f0-9]{64}$/
export const REGISTRATION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/\-. ]{2,29}$/
export const PASSWORD_MIN = 10
export const PASSWORD_MAX = 128
const DEFAULT_MAX_LENGTH = 255

const TYPE_RULES = ['string', 'text', 'raw', 'name', 'email', 'phone', 'date', 'time', 'uuid', 'integer', 'boolean', 'accepted', 'password', 'token', 'registration_number']
const UNCLEANED_TYPES = ['raw', 'password', 'boolean', 'accepted']
const LOCAL_PART_PATTERN = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/

const length = (text) => [...text].length
const isPlainObject = (value) => value !== null && typeof value === 'object'
const has = (object, key) => Object.hasOwn(object, key)

const parseRules = (rules) => {
  const list = Array.isArray(rules) ? rules : rules.split('|')
  const parsed = {}
  for (const raw of list) {
    const rule = String(raw).trim()
    if (rule === '') continue
    if (rule.startsWith('regex:')) {
      parsed.regex = rule.slice(6)
    } else if (rule.includes(':')) {
      const index = rule.indexOf(':')
      parsed[rule.slice(0, index)] = rule.slice(index + 1)
    } else {
      parsed[rule] = true
    }
  }
  return parsed
}

const toRegExp = (source) => {
  const match = /^(.)([\s\S]*)\1([a-z]*)$/.exec(source)
  return match ? new RegExp(match[2], match[3].replace(/[^gimsuy]/g, '')) : new RegExp(source)
}

const filterInt = (value) => {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? value : null
  if (typeof value === 'boolean') return null
  const text = String(value).trim()
  return /^[+-]?(?:0|[1-9]\d*)$/.test(text) && Number.isSafeInteger(Number(text)) ? Number(text) : null
}

const filterBoolean = (value) => {
  if (typeof value === 'boolean') return value
  const text = String(value).trim().toLowerCase()
  if (['1', 'true', 'on', 'yes'].includes(text)) return true
  if (['0', 'false', 'off', 'no', ''].includes(text)) return false
  return null
}

export const passwordProblem = (password) => {
  const size = length(password)
  if (size < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`
  if (size > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`
  if (!/\p{Ll}/u.test(password) || !/\p{Lu}/u.test(password) || !/\d/.test(password) || !/[^\p{L}\d]/u.test(password)) {
    return 'Include upper and lower case letters, a number and a symbol.'
  }
  return null
}

const isValidEmailShape = (email) => {
  if (email.length > 254) return false
  const at = email.lastIndexOf('@')
  if (at < 1 || at === email.length - 1) return false
  const local = email.slice(0, at)
  return local.length <= 64 && LOCAL_PART_PATTERN.test(local) && EMAIL_DOMAIN_PATTERN.test(email.slice(at + 1))
}

export class Validator {
  constructor({ timezone = 'Asia/Kolkata' } = {}) {
    this.timezone = timezone
    this.errors = {}
    this.threats = []
  }

  validate(input, rules, messages = {}) {
    this.errors = {}
    this.threats = []
    const output = {}

    for (const [field, fieldRules] of Object.entries(rules)) {
      const parsed = parseRules(fieldRules)
      const present = has(input, field)
      let value = present ? input[field] : null
      if (parsed.sometimes && !present) continue

      const type = TYPE_RULES.find((candidate) => parsed[candidate]) ?? 'string'
      if (typeof value === 'string' && !UNCLEANED_TYPES.includes(type)) value = clean(value, type === 'text')

      if (this.isEmpty(value, type)) {
        if (parsed.required) {
          this.fail(field, 'required', messages, type === 'accepted' ? 'You must accept this to continue.' : 'This field is required.')
          continue
        }
        if (parsed.nullable || present) output[field] = null
        continue
      }

      if (isPlainObject(value)) {
        this.fail(field, 'string', messages, 'This field has an invalid format.')
        continue
      }

      const result = this.applyType(field, type, value, messages)
      if (result === undefined) continue
      if (!this.applyConstraints(field, type, result, parsed, input, messages)) continue
      output[field] = result
    }

    if (Object.keys(this.errors).length > 0) {
      throw new ValidationError(this.errors, 'Please correct the highlighted fields.', this.threats)
    }
    return output
  }

  isEmpty(value, type) {
    if (value === null || value === undefined) return true
    if (typeof value === 'string') return type === 'password' || type === 'raw' ? value === '' : value.trim() === ''
    if (Array.isArray(value)) return value.length === 0
    if (type === 'accepted') return value === false
    return false
  }

  applyType(field, type, input, messages) {
    if (['integer', 'boolean', 'accepted'].includes(type)) return this.applyScalarType(field, type, input, messages)

    let value = input
    if (typeof value !== 'string') {
      if (typeof value === 'number') {
        value = String(value)
      } else {
        this.fail(field, type, messages, 'This field has an invalid format.')
        return undefined
      }
    }

    if (!['raw', 'password', 'token'].includes(type)) {
      const threat = detectThreat(value)
      if (threat !== null) {
        this.threats.push({ field, type: threat, sample: [...value].slice(0, 200).join('') })
        this.fail(field, 'safe', messages, 'This field contains characters or patterns that are not allowed.')
        return undefined
      }
    } else if (!value.isWellFormed()) {
      this.fail(field, type, messages, 'This field has an invalid format.')
      return undefined
    }

    switch (type) {
      case 'name':
        if (!NAME_PATTERN.test(value)) return this.reject(field, 'name', messages, 'Use letters, spaces, apostrophes, dots and hyphens only.')
        return value
      case 'email': {
        const email = value.toLowerCase()
        if (!isValidEmailShape(email)) return this.reject(field, 'email', messages, 'Enter a valid email address.')
        return email
      }
      case 'phone': {
        const phone = value.replace(/[\s\-()]/g, '')
        if (!PHONE_PATTERN.test(phone)) return this.reject(field, 'phone', messages, 'Enter a valid 10 digit Indian mobile number.')
        return phone.slice(-10)
      }
      case 'date': {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
        const date = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null
        if (!date || date.toISOString().slice(0, 10) !== value) return this.reject(field, 'date', messages, 'Enter a valid date (YYYY-MM-DD).')
        return value
      }
      case 'time':
        if (!TIME_PATTERN.test(value)) return this.reject(field, 'time', messages, 'Enter a valid time (HH:MM).')
        return value.slice(0, 5)
      case 'uuid':
        if (!UUID_PATTERN.test(value)) return this.reject(field, 'uuid', messages, 'This identifier is not valid.')
        return value.toLowerCase()
      case 'token':
        if (!TOKEN_PATTERN.test(value)) return this.reject(field, 'token', messages, 'This link is invalid or has expired.')
        return value
      case 'registration_number':
        if (!REGISTRATION_PATTERN.test(value)) {
          return this.reject(field, 'registration_number', messages, 'Use 3 to 30 letters, digits, spaces, dots, slashes or hyphens.')
        }
        return value
      case 'password': {
        const problem = passwordProblem(value)
        if (problem !== null) return this.reject(field, 'password', messages, problem)
        return value
      }
      default:
        return value
    }
  }

  reject(field, rule, messages, fallback) {
    this.fail(field, rule, messages, fallback)
    return undefined
  }

  applyScalarType(field, type, value, messages) {
    if (type === 'integer') {
      const int = filterInt(value)
      if (int === null) return this.reject(field, 'integer', messages, 'Enter a whole number.')
      return int
    }
    const bool = Array.isArray(value) ? null : filterBoolean(value)
    if (bool === null) return this.reject(field, type, messages, 'This field must be true or false.')
    if (type === 'accepted' && bool !== true) return this.reject(field, 'accepted', messages, 'You must accept this to continue.')
    return bool
  }

  applyConstraints(field, type, value, parsed, input, messages) {
    const isNumeric = type === 'integer'
    const measure = isNumeric ? value : typeof value === 'string' ? length(value) : null
    if (measure !== null) {
      const max = parsed.max !== undefined ? Number.parseInt(parsed.max, 10) : isNumeric || type === 'password' ? null : DEFAULT_MAX_LENGTH
      if (parsed.min !== undefined && measure < Number.parseInt(parsed.min, 10)) {
        const min = Number.parseInt(parsed.min, 10)
        this.fail(field, 'min', messages, isNumeric ? `Must be at least ${min}.` : `Must be at least ${min} characters.`)
        return false
      }
      if (max !== null && measure > max) {
        this.fail(field, 'max', messages, isNumeric ? `Must be at most ${max}.` : `Must be at most ${max} characters.`)
        return false
      }
    }

    if (parsed.in !== undefined && !String(parsed.in).split(',').includes(String(value))) {
      this.fail(field, 'in', messages, 'Choose one of the allowed options.')
      return false
    }

    if (parsed.regex !== undefined && typeof value === 'string' && !toRegExp(parsed.regex).test(value)) {
      this.fail(field, 'regex', messages, 'This field has an invalid format.')
      return false
    }

    if (type === 'date') {
      for (const rule of ['before', 'after', 'before_or_equal', 'after_or_equal']) {
        if (parsed[rule] === undefined) continue
        const isToday = parsed[rule] === 'today'
        const bound = isToday ? zonedDate(new Date(), this.timezone) : String(parsed[rule])
        const passed = {
          before: value < bound,
          after: value > bound,
          before_or_equal: value <= bound,
          after_or_equal: value >= bound,
        }[rule]
        if (!passed) {
          this.fail(field, rule, messages, `The date must be ${rule.replaceAll('_', ' ')} ${isToday ? 'today' : bound}.`)
          return false
        }
      }
    }

    if (parsed.confirmed) {
      const confirmation = input[`${field}_confirmation`]
      if (typeof confirmation !== 'string' || confirmation !== String(value)) {
        this.errors[`${field}_confirmation`] = messages[`${field}.confirmed`] ?? 'The values do not match.'
        return false
      }
    }

    if (parsed.different !== undefined && typeof value === 'string') {
      const other = input[String(parsed.different)]
      if (typeof other === 'string' && other === value) {
        this.fail(field, 'different', messages, 'Choose a value different from the current one.')
        return false
      }
    }
    return true
  }

  fail(field, rule, messages, fallback) {
    if (this.errors[field] === undefined) this.errors[field] = messages[`${field}.${rule}`] ?? messages[field] ?? fallback
  }
}

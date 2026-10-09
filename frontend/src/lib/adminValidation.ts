import { compose, MESSAGES, normalise, rules, type FieldValidator, type FormValue } from './validation'

export const HTTPS_URL_PATTERN = /^https:\/\/[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}(?::\d{1,5})?(?:[/?#][^\s<>"'\\]*)?$/
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const CODE_PATTERN = /^[a-z0-9]+(_[a-z0-9]+)*$/
export const POSTAL_CODE_PATTERN = /^[1-9]\d{5}$/
export const AMOUNT_PATTERN = /^\d{1,8}(\.\d{1,2})?$/

function text(value: FormValue): string {
  return typeof value === 'string' ? normalise(value) : ''
}

function blank(value: FormValue): boolean {
  return typeof value === 'string' ? text(value) === '' : value === false
}

export const adminRules = {
  httpsUrl:
    (message = 'Enter a link that starts with https://'): FieldValidator =>
    (value) =>
      !blank(value) && !HTTPS_URL_PATTERN.test(text(value)) ? message : null,
  slug:
    (message = 'Use lowercase letters, digits and single hyphens.'): FieldValidator =>
    (value) =>
      !blank(value) && !SLUG_PATTERN.test(text(value)) ? message : null,
  code:
    (message = 'Use lowercase letters, digits and single underscores.'): FieldValidator =>
    (value) =>
      !blank(value) && !CODE_PATTERN.test(text(value)) ? message : null,
  postalCode:
    (message = 'Enter a 6 digit PIN code.'): FieldValidator =>
    (value) =>
      !blank(value) && !POSTAL_CODE_PATTERN.test(text(value)) ? message : null,
  amount:
    (message = 'Enter an amount such as 800 or 800.50.'): FieldValidator =>
    (value) =>
      !blank(value) && !AMOUNT_PATTERN.test(text(value)) ? message : null,
  integerBetween:
    (min: number, max: number): FieldValidator =>
    (value) => {
      if (blank(value)) {
        return null
      }
      const raw = text(value)
      if (!/^-?\d+$/.test(raw)) {
        return 'Enter a whole number.'
      }
      const number = Number(raw)
      if (number < min) {
        return `Must be at least ${min}.`
      }
      return number > max ? `Must be at most ${max}.` : null
    },
  latitude: (): FieldValidator => (value) =>
    blank(value) || (/^-?\d{1,2}(\.\d{1,6})?$/.test(text(value)) && Math.abs(Number(text(value))) <= 90) ? null : 'Latitude must be between -90 and 90.',
  longitude: (): FieldValidator => (value) =>
    blank(value) || (/^-?\d{1,3}(\.\d{1,6})?$/.test(text(value)) && Math.abs(Number(text(value))) <= 180) ? null : 'Longitude must be between -180 and 180.',
  time: (): FieldValidator => (value) =>
    blank(value) || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(text(value)) ? null : 'Enter a time such as 09:00.',
  date: (): FieldValidator => (value) =>
    blank(value) || /^\d{4}-\d{2}-\d{2}$/.test(text(value)) ? null : MESSAGES.date,
}

export function composeAll(...validators: (FieldValidator | undefined)[]): FieldValidator {
  return compose(...validators.filter((validator): validator is FieldValidator => validator !== undefined))
}

export { rules }

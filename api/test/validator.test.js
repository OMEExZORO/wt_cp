import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ValidationError } from '../src/core/errors.js'
import { clean, detectThreat } from '../src/validation/sanitizer.js'
import { Validator, passwordProblem } from '../src/validation/validator.js'

const validate = (input, rules, messages) => new Validator().validate(input, rules, messages)
const failures = (input, rules, messages) => {
  try {
    validate(input, rules, messages)
  } catch (error) {
    assert.ok(error instanceof ValidationError)
    return error.fields
  }
  assert.fail('expected validation to fail')
}

describe('Validator', () => {
  it('normalises email, phone and names', () => {
    const out = validate(
      { email: '  Jane@Example.COM ', phone: '+91 98765-43210', full_name: "  Anne-Marie  O'Neil " },
      { email: 'required|email', phone: 'required|phone', full_name: 'required|name|min:2' },
    )
    assert.deepEqual(out, { email: 'jane@example.com', phone: '9876543210', full_name: "Anne-Marie O'Neil" })
  })

  it('reports required, format and length messages', () => {
    assert.deepEqual(failures({}, { email: 'required|email' }), { email: 'This field is required.' })
    assert.deepEqual(failures({ email: 'nope' }, { email: 'required|email' }), { email: 'Enter a valid email address.' })
    assert.deepEqual(failures({ phone: '12345' }, { phone: 'required|phone' }), { phone: 'Enter a valid 10 digit Indian mobile number.' })
    assert.deepEqual(failures({ name: 'A' }, { name: 'required|name|min:2' }), { name: 'Must be at least 2 characters.' })
    assert.deepEqual(failures({ name: '1abc' }, { name: 'required|name' }), { name: 'Use letters, spaces, apostrophes, dots and hyphens only.' })
  })

  it('enforces password policy and confirmation', () => {
    assert.equal(passwordProblem('short'), 'Use at least 10 characters.')
    assert.equal(passwordProblem('alllowercase1!'), 'Include upper and lower case letters, a number and a symbol.')
    assert.equal(passwordProblem('Correct-Horse-9'), null)
    const rules = { password: 'required|password|confirmed' }
    assert.deepEqual(failures({ password: 'Correct-Horse-9', password_confirmation: 'x' }, rules), { password_confirmation: 'The values do not match.' })
    assert.equal(validate({ password: 'Correct-Horse-9', password_confirmation: 'Correct-Horse-9' }, rules).password, 'Correct-Horse-9')
  })

  it('handles booleans, accepted and nullable fields', () => {
    const rules = { remember: 'nullable|boolean', consent: 'required|accepted' }
    assert.deepEqual(validate({ consent: true }, rules), { remember: null, consent: true })
    assert.deepEqual(validate({ remember: 'yes', consent: 'on' }, rules), { remember: true, consent: true })
    assert.deepEqual(failures({ consent: false }, rules, { 'consent.required': 'Please give your consent to continue.' }), {
      consent: 'Please give your consent to continue.',
    })
    assert.deepEqual(failures({ remember: 'maybe', consent: true }, rules), { remember: 'This field must be true or false.' })
  })

  it('validates dates against bounds and tokens as lowercase hex', () => {
    assert.deepEqual(failures({ d: '2999-01-01' }, { d: 'required|date|before:today' }), { d: 'The date must be before today.' })
    assert.deepEqual(failures({ d: '2026-02-30' }, { d: 'required|date' }), { d: 'Enter a valid date (YYYY-MM-DD).' })
    assert.deepEqual(failures({ token: 'abc' }, { token: 'required|token' }), { token: 'This link is invalid or has expired.' })
    assert.equal(validate({ token: 'a'.repeat(64) }, { token: 'required|token' }).token, 'a'.repeat(64))
  })

  it('supports sometimes and in rules and rejects arrays', () => {
    assert.deepEqual(validate({}, { phone: 'sometimes|required|phone' }), {})
    assert.deepEqual(failures({ type: 'x' }, { type: 'required|in:patient,referrer' }), { type: 'Choose one of the allowed options.' })
    assert.deepEqual(failures({ city: ['a'] }, { city: 'required|string' }), { city: 'This field has an invalid format.' })
  })

  it('rejects injection payloads and records threats', () => {
    const validator = new Validator()
    assert.throws(() => validator.validate({ city: "x' OR '1'='1" }, { city: 'required|string' }), ValidationError)
    assert.equal(validator.threats[0].type, 'sqli')
    assert.throws(() => validator.validate({ city: '<script>alert(1)</script>' }, { city: 'required|string' }), ValidationError)
    assert.equal(validator.threats[0].type, 'xss')
  })

  it('does not scan raw password fields', () => {
    assert.equal(validate({ password: "x' OR '1'='1" }, { password: 'required|raw|max:128' }).password, "x' OR '1'='1")
  })
})

describe('Sanitizer', () => {
  it('strips control and zero-width characters and collapses whitespace', () => {
    assert.equal(clean('  a​b \t\n c\u0000 '), 'ab c')
    assert.equal(clean('line one  \r\n\r\n\r\n\r\nline two', true), 'line one\n\nline two')
  })

  it('detects url-encoded attacks', () => {
    assert.equal(detectThreat('%3Cscript%3E'), 'xss')
    assert.equal(detectThreat('1; DROP TABLE users'), 'sqli')
    assert.equal(detectThreat('Mumbai'), null)
  })
})

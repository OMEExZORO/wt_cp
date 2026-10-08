import { detectThreat, fieldRules, passwordProblem, rules } from './validation'

describe('validation rules mirror the server', () => {
  it.each([
    ["' OR '1'='1", 'sqli'],
    ["'; DROP TABLE users;--", 'sqli'],
    ['1 UNION SELECT password_hash FROM users', 'sqli'],
    ['<script>alert(1)</script>', 'xss'],
    ['<img src=x onerror=alert(1)>', 'xss'],
  ])('detects %s', (payload, type) => {
    expect(detectThreat(payload)).toBe(type)
  })

  it.each(["Asha D'Souza", 'Fasting or full bladder required', 'BP < 120'])('allows %s', (value) => {
    expect(detectThreat(value)).toBeNull()
  })

  it('validates Indian mobile numbers with optional +91', () => {
    expect(fieldRules.phone('+91 98765 43210', {})).toBeNull()
    expect(fieldRules.phone('9876543210', {})).toBeNull()
    expect(fieldRules.phone('5876543210', {})).not.toBeNull()
    expect(fieldRules.phone('98765', {})).not.toBeNull()
  })

  it('validates names and emails', () => {
    expect(fieldRules.fullName('Dr. R. K. Jain-Shah', {})).toBeNull()
    expect(fieldRules.fullName('Asha123', {})).not.toBeNull()
    expect(fieldRules.email('a.b@mail.example.co.in', {})).toBeNull()
    expect(fieldRules.email('user@localhost', {})).not.toBeNull()
  })

  it('enforces password strength and confirmation', () => {
    expect(passwordProblem('Strong@Pass2026')).toBeNull()
    expect(passwordProblem('NoSymbols12345')).not.toBeNull()
    expect(rules.matches('password')('a', { password: 'b' })).not.toBeNull()
  })

  it('rejects oversized input', () => {
    expect(fieldRules.fullName('A'.repeat(500), {})).not.toBeNull()
  })
})

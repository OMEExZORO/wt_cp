import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decideEscalation } from '../src/jobs/escalationLogic.js'

const WINDOW = 30 * 60 * 1000
const base = new Date('2026-10-08T10:00:00Z')
const at = (minutes) => new Date(base.getTime() + minutes * 60000)

const alert = (overrides = {}) => ({
  status: 'open',
  escalation_level: 0,
  acknowledged_at: null,
  created_at: base.toISOString(),
  last_notified_at: null,
  next_escalation_at: null,
  ...overrides,
})

test('does nothing before the window elapses', () => {
  assert.equal(decideEscalation(alert(), at(29), WINDOW), 'none')
})

test('stage 1 resend once the window elapses', () => {
  assert.equal(decideEscalation(alert(), at(30), WINDOW), 'resend')
})

test('uses next_escalation_at when present', () => {
  const a = alert({ next_escalation_at: at(10).toISOString() })
  assert.equal(decideEscalation(a, at(9), WINDOW), 'none')
  assert.equal(decideEscalation(a, at(10), WINDOW), 'resend')
})

test('uses last_notified_at when no next_escalation_at', () => {
  const a = alert({ last_notified_at: at(5).toISOString() })
  assert.equal(decideEscalation(a, at(34), WINDOW), 'none')
  assert.equal(decideEscalation(a, at(35), WINDOW), 'resend')
})

test('stage 2 flags staff after a further window', () => {
  const a = alert({ status: 'escalated', escalation_level: 1, next_escalation_at: at(60).toISOString() })
  assert.equal(decideEscalation(a, at(59), WINDOW), 'none')
  assert.equal(decideEscalation(a, at(60), WINDOW), 'flag_staff')
})

test('is idempotent after the staff flag', () => {
  const a = alert({ status: 'escalated', escalation_level: 2 })
  assert.equal(decideEscalation(a, at(500), WINDOW), 'none')
})

test('acknowledged and terminal alerts are never escalated', () => {
  assert.equal(decideEscalation(alert({ acknowledged_at: at(1).toISOString() }), at(500), WINDOW), 'none')
  for (const status of ['acknowledged', 'resolved', 'cancelled']) {
    assert.equal(decideEscalation(alert({ status }), at(500), WINDOW), 'none')
  }
})

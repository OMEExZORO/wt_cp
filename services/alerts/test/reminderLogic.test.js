import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isReminderDue, selectDueReminders } from '../src/jobs/reminderLogic.js'
import { reminderMessage } from '../src/jobs/messages.js'

const LEAD = 24 * 3600 * 1000
const now = new Date('2026-10-08T10:00:00Z')
const inHours = (h) => new Date(now.getTime() + h * 3600000).toISOString()
const appt = (overrides = {}) => ({ status: 'confirmed', reminder_sent_at: null, starts_at: inHours(12), ...overrides })

test('confirmed appointment within 24h is due', () => {
  assert.equal(isReminderDue(appt(), now, LEAD), true)
  assert.equal(isReminderDue(appt({ starts_at: inHours(24) }), now, LEAD), true)
})

test('appointment further than 24h away is not due', () => {
  assert.equal(isReminderDue(appt({ starts_at: inHours(24.5) }), now, LEAD), false)
})

test('past appointments are not due', () => {
  assert.equal(isReminderDue(appt({ starts_at: inHours(-1) }), now, LEAD), false)
})

test('already reminded or non-confirmed appointments are skipped', () => {
  assert.equal(isReminderDue(appt({ reminder_sent_at: inHours(-2) }), now, LEAD), false)
  for (const status of ['pending', 'cancelled', 'completed', 'no_show', 'checked_in']) {
    assert.equal(isReminderDue(appt({ status }), now, LEAD), false)
  }
})

test('selectDueReminders filters a list', () => {
  const list = [appt(), appt({ starts_at: inHours(40) }), appt({ status: 'cancelled' })]
  assert.equal(selectDueReminders(list, now, LEAD).length, 1)
})

test('reminder message includes preparation tips and checklist', () => {
  const message = reminderMessage({
    patientName: 'Asha',
    appointment: { reference_code: 'MDC-1', scan_name: 'Whole Abdomen USG', branch_name: 'Bhosari', branch_address: 'Nagdev Tower', when_label: '09 Oct 2026 at 10:00' },
    prepTips: 'Fast for six hours.',
    checklist: [{ question: 'Are you pregnant?', help_text: null }],
  })
  assert.match(message.text, /Fast for six hours/)
  assert.match(message.text, /Are you pregnant/)
  assert.match(message.subject, /Whole Abdomen USG/)
})

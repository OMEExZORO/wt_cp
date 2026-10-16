import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ConflictError, ValidationError } from '../src/core/errors.js'
import { Validator } from '../src/validation/validator.js'
import { assertTransition } from '../src/services/booking/booking-service.js'
import { attentionAnswers, checklistRules, evaluateAnswers, prefixErrors } from '../src/services/booking/checklist-evaluator.js'
import { buildGoogleLink } from '../src/services/booking/google-calendar-link.js'
import { buildEvent, escapeText, icsFilename } from '../src/services/booking/ics-calendar.js'
import { REFERENCE_PATTERN, generateReference } from '../src/services/booking/reference-code.js'
import * as capacity from '../src/services/booking/slot-capacity.js'
import { ScanType } from '../src/models/scan-type.js'

const at = (value) => new Date(`${value.replace(' ', 'T')}:00+05:30`)

describe('SlotCapacity', () => {
  const now = at('2026-10-08 10:00')
  const slot = (overrides = {}) => ({
    id: 'slot-1',
    branch_id: 'branch-1',
    modality: 'CT',
    slot_date: '2026-10-09',
    start_time: '09:00:00',
    end_time: '09:30:00',
    capacity: 1,
    booked_count: 0,
    is_blocked: false,
    branch_is_active: true,
    ...overrides,
  })

  it('computes remaining places', () => {
    const cases = [
      [2, 0, false, 2],
      [2, 1, false, 1],
      [1, 1, false, 0],
      [1, 3, false, 0],
      [4, 0, true, 0],
      [0, 0, false, 0],
    ]
    for (const [cap, booked, blocked, expected] of cases) assert.equal(capacity.remaining(cap, booked, blocked), expected)
  })

  it('classifies slots', () => {
    assert.equal(capacity.status(slot(), now, 'CT'), capacity.OK)
    assert.equal(capacity.status(slot({ booked_count: 1 }), now, 'CT'), capacity.FULL)
    const usg = slot({ modality: 'USG', capacity: 2, booked_count: 1 })
    assert.equal(capacity.status(usg, now, 'USG'), capacity.OK)
    assert.equal(capacity.status({ ...usg, booked_count: 2 }, now, 'USG'), capacity.FULL)
    assert.equal(capacity.status(slot({ is_blocked: 't' }), now), capacity.BLOCKED)
    assert.equal(capacity.status(slot({ slot_date: '2026-10-08', start_time: '10:00:00' }), now), capacity.PAST)
    assert.equal(capacity.status(slot({ slot_date: '2026-10-08', start_time: '10:30:00', end_time: '11:00:00' }), now), capacity.OK)
    assert.equal(capacity.status(slot(), now, 'USG'), capacity.WRONG_MODALITY)
    assert.equal(capacity.status(slot({ branch_is_active: false }), now), capacity.BRANCH_INACTIVE)
  })

  it('increments, releases and detects a full branch', () => {
    assert.equal(capacity.afterBooking(2, 0), 1)
    assert.equal(capacity.afterBooking(2, 1), 2)
    assert.throws(() => capacity.afterBooking(2, 2), RangeError)
    assert.equal(capacity.afterRelease(1), 0)
    assert.equal(capacity.afterRelease(0), 0)
    assert.equal(capacity.afterRelease(3), 2)
    const slots = [slot({ booked_count: 1 }), slot({ is_blocked: true }), slot({ slot_date: '2026-10-08', start_time: '09:00:00' })]
    assert.equal(capacity.isBranchFull(slots, now), true)
    slots.push(slot({ start_time: '12:00:00', end_time: '12:30:00' }))
    assert.equal(capacity.isBranchFull(slots, now), false)
  })

  it('uses Indian Standard Time for slot boundaries', () => {
    assert.equal(capacity.atom(capacity.startsAt(slot())), '2026-10-09T09:00:00+05:30')
    assert.equal(capacity.atom(capacity.endsAt(slot())), '2026-10-09T09:30:00+05:30')
  })

  it('has the PHP messages', () => {
    assert.equal(capacity.message(capacity.FULL), 'This time slot has just been fully booked. Please choose another time.')
    assert.equal(capacity.message(capacity.OK), 'This time slot is available.')
  })
})

describe('booking status transitions', () => {
  const slot = (date = '2026-10-08', start = '10:00:00') => ({ slot_date: date, start_time: start, end_time: '10:30:00' })
  const now = at('2026-10-08 11:00')

  it('allows the documented transitions', () => {
    const allowed = [
      ['confirmed', 'checked_in'],
      ['pending', 'checked_in'],
      ['checked_in', 'in_progress'],
      ['checked_in', 'completed'],
      ['in_progress', 'completed'],
      ['confirmed', 'no_show'],
    ]
    for (const [from, to] of allowed) assertTransition(from, to, slot(), now)
  })

  it('refuses the rest', () => {
    const refused = [
      ['cancelled', 'checked_in'],
      ['completed', 'checked_in'],
      ['no_show', 'completed'],
      ['confirmed', 'completed'],
      ['in_progress', 'no_show'],
    ]
    for (const [from, to] of refused) assert.throws(() => assertTransition(from, to, slot(), now), ConflictError)
  })

  it('checks in only on the day and marks no-show only after the start', () => {
    assert.throws(() => assertTransition('confirmed', 'checked_in', slot('2026-10-09'), now), ConflictError)
    assert.throws(() => assertTransition('confirmed', 'no_show', slot('2026-10-08', '12:00:00'), now), ConflictError)
  })

  it('reports the PHP message and field', () => {
    try {
      assertTransition('no_show', 'completed', slot(), now)
      assert.fail('expected a conflict')
    } catch (error) {
      assert.equal(error.message, 'An appointment that is no show cannot be marked completed.')
      assert.deepEqual(error.fields, { status: 'This status change is not allowed.' })
    }
  })
})

describe('ChecklistEvaluator', () => {
  const ALLERGY = '11111111-1111-4111-8111-111111111111'
  const COMPANION = '22222222-2222-4222-8222-222222222222'
  const LMP = '33333333-3333-4333-8333-333333333333'
  const NOTES = '44444444-4444-4444-8444-444444444444'
  const items = () => [
    { id: ALLERGY, code: 'ct_contrast_allergy', question: 'Contrast allergy?', answer_type: 'yes_no_unsure', is_required: true, attention_answers: '{yes,unsure}' },
    { id: COMPANION, code: 'biopsy_companion', question: 'Companion?', answer_type: 'yes_no', is_required: 't', attention_answers: '{no}' },
    { id: LMP, code: 'pelvic_lmp_date', question: 'LMP', answer_type: 'date', is_required: false, attention_answers: '{}' },
    { id: NOTES, code: 'free_text', question: 'Anything else?', answer_type: 'text', is_required: false, attention_answers: [] },
  ]

  it('builds rules per answer type', () => {
    const rules = checklistRules(items())
    assert.equal(rules[ALLERGY], 'required|in:yes,no,unsure')
    assert.equal(rules[COMPANION], 'required|in:yes,no')
    assert.ok(rules[LMP].startsWith('nullable|date'))
    assert.equal(rules[NOTES], 'nullable|text|max:500')
  })

  it('parses postgres arrays', () => {
    assert.deepEqual(attentionAnswers('{yes,unsure}'), ['yes', 'unsure'])
    assert.deepEqual(attentionAnswers('{}'), [])
    assert.deepEqual(attentionAnswers(['no']), ['no'])
    assert.deepEqual(attentionAnswers('{"a b"}'), ['a b'])
  })

  it('flags attention answers', () => {
    let result = evaluateAnswers(items(), { [ALLERGY]: 'unsure', [COMPANION]: 'yes', [LMP]: null })
    assert.equal(result.length, 2)
    assert.equal(result[0].code, 'ct_contrast_allergy')
    assert.equal(result[0].needs_attention, true)
    assert.equal(result[1].needs_attention, false)
    result = evaluateAnswers(items(), { [ALLERGY]: 'no', [COMPANION]: 'no' })
    assert.equal(result[0].needs_attention, false)
    assert.equal(result[1].needs_attention, true)
  })

  it('rejects missing required answers and unknown options', () => {
    try {
      new Validator().validate({ [ALLERGY]: 'maybe', [LMP]: '2999-01-01' }, checklistRules(items()))
      assert.fail('expected validation to fail')
    } catch (error) {
      assert.ok(error instanceof ValidationError)
      const fields = prefixErrors(error.fields)
      assert.ok(`answers.${ALLERGY}` in fields)
      assert.ok(`answers.${COMPANION}` in fields)
      assert.ok(`answers.${LMP}` in fields)
    }
  })

  it('rejects script payloads in free text', () => {
    try {
      new Validator().validate(
        { [ALLERGY]: 'no', [COMPANION]: 'yes', [NOTES]: '<script>alert(1)</script>' },
        checklistRules(items()),
      )
      assert.fail('expected validation to fail')
    } catch (error) {
      assert.ok(NOTES in error.fields)
      assert.equal(error.threats[0].type, 'xss')
    }
  })
})

describe('GoogleCalendarLink', () => {
  const link = (details = 'Bring reports', location = 'MDC Bhosari, Pune') =>
    buildGoogleLink('CT Brain & contrast at MDC', at('2026-10-09 09:00'), at('2026-10-09 09:30'), details, location)

  it('builds a template url with UTC dates and a literal slash', () => {
    const url = link()
    assert.ok(url.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE&'))
    assert.ok(url.includes('&ctz=Asia%2FKolkata'))
    assert.ok(url.includes('&dates=20261009T033000Z/20261009T040000Z'))
  })

  it('encodes text, details and location', () => {
    const url = link('Line 1\nLine 2', 'Nagdev Tower, Bhosari')
    const query = new URL(url).searchParams
    assert.equal(query.get('text'), 'CT Brain & contrast at MDC')
    assert.equal(query.get('details'), 'Line 1\nLine 2')
    assert.equal(query.get('location'), 'Nagdev Tower, Bhosari')
    assert.ok(url.includes('text=CT%20Brain%20%26%20contrast%20at%20MDC'))
    assert.ok(!url.includes(' '))
  })

  it('omits empty optional parameters and rejects an inverted range', () => {
    const url = link('', '')
    assert.ok(!url.includes('details='))
    assert.ok(!url.includes('location='))
    assert.throws(() => buildGoogleLink('x', at('2026-10-09 10:00'), at('2026-10-09 09:00')))
  })
})

describe('IcsCalendar', () => {
  const event = (overrides = {}) => ({
    uid: '7d3c1d4e-1111-4222-8333-444455556666@diagnocare.test',
    sequence: 2,
    dtstamp: new Date('2026-10-08T22:45:10+05:30'),
    start: at('2026-10-09 09:00'),
    end: at('2026-10-09 09:30'),
    summary: 'CT Brain at MDC Bhosari',
    description: 'Booking reference: MDC-261008-ABCDE\nPreparation: Remove metal items; bring reports, ID',
    location: 'MDC Bhosari, Nagdev Tower, Pune Nashik Road, Pune 411039',
    ...overrides,
  })

  it('produces a CRLF calendar skeleton', () => {
    const ics = buildEvent(event())
    assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:'))
    assert.ok(ics.endsWith('END:VEVENT\r\nEND:VCALENDAR\r\n'))
    assert.equal(/(?<!\r)\n/.test(ics), false)
    assert.equal(ics.split('BEGIN:VEVENT').length - 1, 1)
    assert.ok(ics.includes('METHOD:PUBLISH\r\n'))
    assert.ok(ics.includes('STATUS:CONFIRMED\r\n'))
  })

  it('uses the Kolkata timezone, uid, stamp and sequence', () => {
    const ics = buildEvent(event())
    assert.ok(ics.includes('BEGIN:VTIMEZONE\r\nTZID:Asia/Kolkata\r\n'))
    assert.ok(ics.includes('TZOFFSETTO:+0530\r\n'))
    assert.ok(ics.includes('DTSTART;TZID=Asia/Kolkata:20261009T090000\r\n'))
    assert.ok(ics.includes('DTEND;TZID=Asia/Kolkata:20261009T093000\r\n'))
    assert.ok(ics.includes('DTSTAMP:20261008T171510Z\r\n'))
    assert.ok(ics.includes('UID:7d3c1d4e-1111-4222-8333-444455556666@diagnocare.test\r\n'))
    assert.ok(ics.includes('SEQUENCE:2\r\n'))
  })

  it('converts UTC input to local time', () => {
    const ics = buildEvent(event({ start: new Date('2026-10-09T03:30:00Z'), end: new Date('2026-10-09T04:00:00Z') }))
    assert.ok(ics.includes('DTSTART;TZID=Asia/Kolkata:20261009T090000'))
  })

  it('escapes text values', () => {
    assert.equal(escapeText('a;b,c\\d\ne'), 'a\\;b\\,c\\\\d\\ne')
    const unfolded = buildEvent(event()).replaceAll('\r\n ', '')
    assert.ok(unfolded.includes('LOCATION:MDC Bhosari\\, Nagdev Tower\\, Pune Nashik Road\\, Pune 411039'))
    assert.ok(unfolded.includes('Remove metal items\\; bring reports\\, ID'))
  })

  it('folds long lines at 75 octets without splitting characters', () => {
    const ics = buildEvent(event({ description: 'मेघनाद diagnostic centre '.repeat(20) }))
    for (const line of ics.replace(/\r\n$/, '').split('\r\n')) {
      assert.ok(Buffer.byteLength(line) <= 75)
      assert.equal(Buffer.from(line).toString('utf8'), line)
    }
    assert.ok(ics.includes('\r\n '))
  })

  it('uses CANCEL for cancelled events and rejects inverted ranges', () => {
    const ics = buildEvent(event({ status: 'CANCELLED' }))
    assert.ok(ics.includes('METHOD:CANCEL\r\n'))
    assert.ok(ics.includes('STATUS:CANCELLED\r\n'))
    assert.ok(!ics.includes('BEGIN:VALARM'))
    const base = event()
    assert.throws(() => buildEvent({ ...base, end: base.start }))
  })

  it('builds safe filenames', () => {
    assert.equal(icsFilename('MDC-261008-ABCDE'), 'appointment-mdc-261008-abcde.ics')
    assert.equal(icsFilename('../etc/passwd'), 'appointment-etcpasswd.ics')
  })
})

describe('reference codes and LIKE escaping', () => {
  it('generates codes matching the pattern', () => {
    for (let i = 0; i < 20; i += 1) assert.match(generateReference(at('2026-10-08 10:00')), REFERENCE_PATTERN)
    assert.ok(generateReference(at('2026-10-08 10:00')).startsWith('MDC-261008-'))
  })

  it('neutralises wildcards', () => {
    assert.equal(ScanType.escapeLike('100%_a\\b'), '100\\%\\_a\\\\b')
  })
})

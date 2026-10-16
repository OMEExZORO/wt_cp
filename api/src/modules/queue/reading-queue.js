import { parseTimestamp } from '../../core/time.js'

export const RANK = { Urgent: 0, Priority: 1, Routine: 2 }

export const rank = (urgency) => (Object.hasOwn(RANK, urgency) ? RANK[urgency] : 3)

export const waitingMinutes = (since, now) => {
  if (since === null || since === undefined || since === '') return 0
  const start = parseTimestamp(since)
  if (start === null) return 0
  return Math.max(0, Math.trunc((now.getTime() - start.getTime()) / 60000))
}

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

export const sortQueue = (rows, now) =>
  rows
    .map((row) => ({ ...row, waiting_minutes: waitingMinutes(row.waiting_since ?? null, now) }))
    .sort(
      (a, b) =>
        compare(rank(String(a.urgency)), rank(String(b.urgency))) ||
        compare(-a.waiting_minutes, -b.waiting_minutes) ||
        compare(String(a.reference_code ?? ''), String(b.reference_code ?? '')),
    )

export const level = (urgency, minutes) => {
  const limit = urgency === 'Urgent' ? 30 : urgency === 'Priority' ? 120 : 360
  if (minutes >= limit) return 'overdue'
  return minutes >= Math.trunc(limit / 2) ? 'warning' : 'ok'
}

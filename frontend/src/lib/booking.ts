import { ApiError } from '../api/client'
import type { Appointment, AppointmentStatus, ChecklistItem, SlotSuggestion } from '../types/booking'
import { MESSAGES, detectThreat, normalise } from './validation'

export const BOOKING_WINDOW_DAYS = 90
export const ANSWER_MAX = 500
export const NOTES_MAX = 1000

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function todayIso(): string {
  return toIsoDate(new Date())
}

export function addDaysIso(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  return toIsoDate(new Date(year, month - 1, day + days))
}

export function lastBookableIso(): string {
  return addDaysIso(todayIso(), BOOKING_WINDOW_DAYS)
}

function parseIso(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatDate(iso: string): string {
  return parseIso(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatShortDate(iso: string): string {
  return parseIso(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function formatTime(hhmm: string): string {
  const [hours, minutes] = hhmm.split(':').map(Number)
  const suffix = hours >= 12 ? 'pm' : 'am'
  const hour = hours % 12 === 0 ? 12 : hours % 12
  return `${hour}:${String(minutes).padStart(2, '0')} ${suffix}`
}

export function formatSlotRange(slot: { start_time: string; end_time: string }): string {
  return `${formatTime(slot.start_time)} to ${formatTime(slot.end_time)}`
}

export function describeAppointmentTime(appointment: Appointment): string {
  return `${formatDate(appointment.slot.date)}, ${formatSlotRange(appointment.slot)}`
}

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function checklistProblem(item: ChecklistItem, raw: string | boolean | undefined): string | null {
  const value = typeof raw === 'string' ? normalise(raw) : ''
  if (value === '') {
    return item.is_required ? 'Please answer this question.' : null
  }
  switch (item.answer_type) {
    case 'yes_no':
      return value === 'yes' || value === 'no' ? null : 'Choose Yes or No.'
    case 'yes_no_unsure':
      return ['yes', 'no', 'unsure'].includes(value) ? null : 'Choose Yes, No or Not sure.'
    case 'date':
      if (!validDate(value)) {
        return MESSAGES.date
      }
      return value > todayIso() || value <= '1900-01-01' ? 'Enter a date that is not in the future.' : null
    default:
      if ([...value].length > ANSWER_MAX) {
        return `Must be at most ${ANSWER_MAX} characters.`
      }
      return detectThreat(value) !== null ? MESSAGES.unsafe : null
  }
}

export function checklistErrors(items: ChecklistItem[], answers: Record<string, string | boolean>): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const item of items) {
    const problem = checklistProblem(item, answers[item.id])
    if (problem !== null) {
      errors[item.id] = problem
    }
  }
  return errors
}

export function notesProblem(notes: string): string | null {
  const value = normalise(notes)
  if ([...value].length > NOTES_MAX) {
    return `Must be at most ${NOTES_MAX} characters.`
  }
  return value !== '' && detectThreat(value) !== null ? MESSAGES.unsafe : null
}

export interface BookingFailure {
  message: string
  fields: Record<string, string>
  checklist: Record<string, string>
  slotFull: boolean
  suggestion: SlotSuggestion | null
}

export function describeBookingError(cause: unknown): BookingFailure {
  if (!(cause instanceof ApiError)) {
    return { message: 'Something went wrong. Please try again.', fields: {}, checklist: {}, slotFull: false, suggestion: null }
  }
  const fields: Record<string, string> = {}
  const checklist: Record<string, string> = {}
  for (const [key, message] of Object.entries(cause.fields)) {
    if (key.startsWith('answers.')) {
      checklist[key.slice('answers.'.length)] = message
    } else {
      fields[key] = message
    }
  }
  const slotFull = cause.status === 409 && cause.extra.reason === 'SLOT_FULL'
  const suggestion = (cause.extra.suggestion ?? null) as SlotSuggestion | null
  return { message: cause.message, fields, checklist, slotFull, suggestion }
}

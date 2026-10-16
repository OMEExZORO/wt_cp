import { atomTimestamp } from '../../core/time.js'
import { flag } from '../../models/flag.js'

export const OK = 'ok'
export const FULL = 'full'
export const BLOCKED = 'blocked'
export const PAST = 'past'
export const BRANCH_INACTIVE = 'branch_inactive'
export const WRONG_MODALITY = 'wrong_modality'
export const TIMEZONE = 'Asia/Kolkata'

const SLOT_DATE = /^\d{4}-\d{2}-\d{2}$/
const SLOT_TIME = /^\d{2}:\d{2}/

export const remaining = (capacity, booked, blocked = false) => {
  if (blocked || capacity <= 0) return 0
  return Math.max(0, capacity - Math.max(0, booked))
}

export const remainingFor = (slot) => remaining(Number(slot.capacity), Number(slot.booked_count), flag(slot.is_blocked ?? false))

export const at = (date, time) => {
  const day = String(date)
  const clock = String(time).slice(0, 5)
  if (!SLOT_DATE.test(day) || !SLOT_TIME.test(clock)) throw new Error('Invalid slot date or time')
  const result = new Date(`${day}T${clock}:00+05:30`)
  if (Number.isNaN(result.getTime())) throw new Error('Invalid slot date or time')
  return result
}

export const startsAt = (slot) => at(slot.slot_date, slot.start_time)
export const endsAt = (slot) => at(slot.slot_date, slot.end_time)
export const hasStarted = (slot, now) => startsAt(slot).getTime() <= now.getTime()
export const atom = (date) => atomTimestamp(date, TIMEZONE)

export const status = (slot, now, modality = null) => {
  if (modality !== null && String(slot.modality) !== modality) return WRONG_MODALITY
  if ('branch_is_active' in slot && !flag(slot.branch_is_active)) return BRANCH_INACTIVE
  if (flag(slot.is_blocked ?? false)) return BLOCKED
  if (hasStarted(slot, now)) return PAST
  if (remainingFor(slot) <= 0) return FULL
  return OK
}

export const message = (state) => {
  switch (state) {
    case FULL:
      return 'This time slot has just been fully booked. Please choose another time.'
    case BLOCKED:
      return 'This time slot is not available for booking.'
    case PAST:
      return 'This time slot has already started. Please choose a later time.'
    case BRANCH_INACTIVE:
      return 'This branch is not taking bookings at the moment.'
    case WRONG_MODALITY:
      return 'This time slot is not for the selected scan.'
    default:
      return 'This time slot is available.'
  }
}

export const afterBooking = (capacity, booked) => {
  if (booked >= capacity) throw new RangeError('Slot capacity exceeded')
  return booked + 1
}

export const afterRelease = (booked) => Math.max(0, booked - 1)

export const isBranchFull = (slots, now) => !slots.some((slot) => status(slot, now) === OK)

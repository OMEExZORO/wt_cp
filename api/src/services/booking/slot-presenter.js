import { flag } from '../../models/flag.js'
import * as capacity from './slot-capacity.js'

export const presentSlot = (slot, now = null) => {
  const remaining = capacity.remainingFor(slot)
  const state = now !== null ? capacity.status(slot, now) : remaining > 0 ? capacity.OK : capacity.FULL
  return {
    id: slot.id,
    branch_id: slot.branch_id,
    modality: slot.modality,
    date: String(slot.slot_date),
    start_time: String(slot.start_time).slice(0, 5),
    end_time: String(slot.end_time).slice(0, 5),
    starts_at: capacity.atom(capacity.startsAt(slot)),
    capacity: Number(slot.capacity),
    booked_count: Number(slot.booked_count),
    remaining,
    is_blocked: flag(slot.is_blocked ?? false),
    is_available: state === capacity.OK,
    status: state,
  }
}

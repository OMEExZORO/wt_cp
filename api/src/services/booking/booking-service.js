import { zonedDate } from '../../core/time.js'
import { ConflictError, NotFoundError, SlotFullError, ValidationError } from '../../core/errors.js'
import { ACTIVE_STATUSES } from '../../models/appointment.js'
import { generateReference } from './reference-code.js'
import { presentSlot } from './slot-presenter.js'
import * as capacity from './slot-capacity.js'

export const TRANSITIONS = {
  pending: ['confirmed', 'checked_in', 'no_show'],
  confirmed: ['checked_in', 'no_show'],
  checked_in: ['in_progress', 'completed'],
  in_progress: ['completed'],
}

const DUPLICATE_MESSAGE = 'You already have a booking in this time slot.'
const duplicate = () => new ConflictError(DUPLICATE_MESSAGE, { slot_id: DUPLICATE_MESSAGE })

export const assertTransition = (from, to, slot, now, timezone = 'Asia/Kolkata') => {
  if (!(TRANSITIONS[from] ?? []).includes(to)) {
    throw new ConflictError(
      `An appointment that is ${from.replaceAll('_', ' ')} cannot be marked ${to.replaceAll('_', ' ')}.`,
      { status: 'This status change is not allowed.' },
    )
  }
  if (to === 'checked_in' && String(slot.slot_date) > zonedDate(now, timezone)) {
    throw new ConflictError('Patients can be checked in only on the day of the appointment.', {
      status: 'Check-in opens on the appointment day.',
    })
  }
  if (to === 'no_show' && !capacity.hasStarted(slot, now)) {
    throw new ConflictError('An appointment can be marked as a no-show only after its start time.', {
      status: 'The appointment has not started yet.',
    })
  }
}

export const presentSuggestion = (slot, kind) => ({
  kind,
  branch: { id: slot.branch_id, name: slot.branch_name, slug: slot.branch_slug },
  slot: presentSlot(slot),
})

export class BookingService {
  constructor({ db, slots, appointments, answers, clock }) {
    this.db = db
    this.slots = slots
    this.appointments = appointments
    this.answers = answers
    this.clock = clock
  }

  async book(patientId, scanType, slotId, answers, notes, urgency, bookedByUserId) {
    try {
      return await this.db.tx(async (tx) => {
        const slots = this.slots.using(tx)
        const appointments = this.appointments.using(tx)
        const slot = await slots.lockForUpdate(slotId)
        if (slot === null) throw ValidationError.withField('slot_id', 'This time slot does not exist.')
        if (await appointments.hasActiveInSlot(patientId, slotId)) throw duplicate()
        this.assertBookable(slot, String(scanType.modality))
        const appointment = await appointments.create({
          reference_code: await this.newReference(appointments),
          patient_id: patientId,
          slot_id: slotId,
          branch_id: slot.branch_id,
          scan_type_id: scanType.id,
          booked_by_user_id: bookedByUserId,
          status: 'confirmed',
          urgency,
          patient_notes: notes,
          consent_given_at: this.clock.atom(),
        })
        await this.answers.using(tx).insertMany(String(appointment.id), answers)
        await slots.incrementBooked(slotId)
        return String(appointment.id)
      })
    } catch (error) {
      throw await this.translate(error, slotId)
    }
  }

  async reschedule(appointmentId, newSlotId, byPatient) {
    try {
      return await this.db.tx(async (tx) => {
        const slots = this.slots.using(tx)
        const appointments = this.appointments.using(tx)
        const appointment = await appointments.lockForUpdate(appointmentId)
        if (appointment === null) throw new NotFoundError('Appointment not found.')
        if (!ACTIVE_STATUSES.includes(appointment.status)) {
          throw new ConflictError('Only upcoming appointments can be rescheduled.')
        }
        if (byPatient && capacity.hasStarted(appointment, this.clock.now())) {
          throw new ConflictError('This appointment has already started and cannot be rescheduled online.')
        }
        const oldSlotId = String(appointment.slot_id)
        if (oldSlotId === newSlotId) {
          throw ValidationError.withField('slot_id', 'Choose a different time from your current booking.')
        }
        const locked = await slots.lockPair(oldSlotId, newSlotId)
        const newSlot = locked[newSlotId] ?? null
        if (newSlot === null) throw ValidationError.withField('slot_id', 'This time slot does not exist.')
        this.assertBookable(newSlot, String(appointment.modality))
        if (await appointments.hasActiveInSlot(String(appointment.patient_id), newSlotId, appointmentId)) throw duplicate()
        await slots.releaseBooked(oldSlotId)
        await slots.incrementBooked(newSlotId)
        await appointments.moveToSlot(appointmentId, newSlotId, String(newSlot.branch_id))
        return {
          from: {
            slot_id: oldSlotId,
            branch_id: appointment.branch_id,
            date: appointment.slot_date,
            start_time: String(appointment.start_time).slice(0, 5),
          },
          to: {
            slot_id: newSlotId,
            branch_id: newSlot.branch_id,
            date: newSlot.slot_date,
            start_time: String(newSlot.start_time).slice(0, 5),
          },
        }
      })
    } catch (error) {
      throw await this.translate(error, newSlotId)
    }
  }

  cancel(appointmentId, reason, byPatient) {
    return this.db.tx(async (tx) => {
      const slots = this.slots.using(tx)
      const appointments = this.appointments.using(tx)
      const appointment = await appointments.lockForUpdate(appointmentId)
      if (appointment === null) throw new NotFoundError('Appointment not found.')
      if (!ACTIVE_STATUSES.includes(appointment.status)) {
        throw new ConflictError('This appointment can no longer be cancelled.')
      }
      if (byPatient && capacity.hasStarted(appointment, this.clock.now())) {
        throw new ConflictError(
          'This appointment has already started and cannot be cancelled online. Please contact the centre.',
        )
      }
      await slots.lockForUpdate(String(appointment.slot_id))
      await slots.releaseBooked(String(appointment.slot_id))
      await appointments.markCancelled(appointmentId, reason)
    })
  }

  changeStatus(appointmentId, status, urgency) {
    return this.db.tx(async (tx) => {
      const appointments = this.appointments.using(tx)
      const appointment = await appointments.lockForUpdate(appointmentId)
      if (appointment === null) throw new NotFoundError('Appointment not found.')
      const current = String(appointment.status)
      if (status !== null && status !== current) {
        assertTransition(current, status, appointment, this.clock.now(), this.clock.timezone)
      }
      if (urgency !== null && ['cancelled', 'no_show', 'completed'].includes(current)) {
        throw new ConflictError('Urgency can only be changed on active appointments.')
      }
      const newStatus = status !== null && status !== current ? status : null
      const newUrgency = urgency !== null && urgency !== appointment.urgency ? urgency : null
      await appointments.applyStatus(appointmentId, newStatus, newUrgency)
      return {
        status: { from: current, to: newStatus ?? current },
        urgency: { from: appointment.urgency, to: newUrgency ?? appointment.urgency },
      }
    })
  }

  async suggestionFor(slot) {
    if (slot === null || slot === undefined) return null
    const fromDate = String(slot.slot_date)
    const fromTime = String(slot.start_time).slice(0, 5)
    const modality = String(slot.modality)
    const branchId = String(slot.branch_id)
    const other = await this.slots.nextAvailable(
      modality, fromDate, this.clock.today(), this.clock.time(), branchId, null, fromTime,
    )
    if (other !== null) return presentSuggestion(other, 'other_branch')
    const same = await this.slots.nextAvailable(
      modality, fromDate, this.clock.today(), this.clock.time(), null, branchId, fromTime,
    )
    return same === null ? null : presentSuggestion(same, 'same_branch')
  }

  async nextAvailable(modality, fromDate, excludeBranchId) {
    const row = await this.slots.nextAvailable(modality, fromDate, this.clock.today(), this.clock.time(), excludeBranchId)
    return row === null ? null : presentSuggestion(row, excludeBranchId !== null ? 'other_branch' : 'any_branch')
  }

  assertBookable(slot, modality) {
    const state = capacity.status(slot, this.clock.now(), modality)
    if (state === capacity.FULL) throw new SlotFullError(capacity.message(state), null, slot)
    if (state !== capacity.OK) throw ValidationError.withField('slot_id', capacity.message(state))
  }

  async newReference(appointments) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = generateReference(this.clock.now(), this.clock.timezone)
      if (!(await appointments.referenceExists(code))) return code
    }
    throw new Error('Could not generate a unique booking reference')
  }

  async translate(error, slotId) {
    if (error instanceof SlotFullError) return error.withSuggestion(await this.suggestionFor(error.slot))
    if (error?.code === '23505') return duplicate()
    if (error?.code === '23514' && String(error.message ?? '').includes('slots_booked_count_check')) {
      const slot = await this.slots.findWithBranch(slotId)
      return new SlotFullError(capacity.message(capacity.FULL), await this.suggestionFor(slot), slot)
    }
    return error
  }
}

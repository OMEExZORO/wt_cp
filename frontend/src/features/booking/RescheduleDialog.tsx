import { useState } from 'react'
import { bookingsApi } from '../../api/bookings'
import { Dialog } from '../../components/Dialog'
import { FormAlert } from '../../components/form/FormAlert'
import { describeAppointmentTime, describeBookingError, formatDate, formatSlotRange, todayIso, type BookingFailure } from '../../lib/booking'
import type { Appointment, Slot, SlotSuggestion } from '../../types/booking'
import { SlotPicker } from './SlotPicker'
import { SuggestionBanner } from './SuggestionBanner'

export interface RescheduleDialogProps {
  appointment: Appointment
  onClose: () => void
  onRescheduled: (appointment: Appointment) => void
}

export function RescheduleDialog({ appointment, onClose, onRescheduled }: RescheduleDialogProps) {
  const [branchId, setBranchId] = useState(appointment.branch.id)
  const [branchName, setBranchName] = useState(appointment.branch.name)
  const [date, setDate] = useState<string | null>(appointment.slot.date >= todayIso() ? appointment.slot.date : todayIso())
  const [slot, setSlot] = useState<Slot | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<BookingFailure | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const apply = (suggestion: SlotSuggestion) => {
    setBranchId(suggestion.branch.id)
    setBranchName(suggestion.branch.name)
    setDate(suggestion.slot.date)
    setSlot(suggestion.slot)
    setFailure(null)
  }

  const confirm = async () => {
    if (slot === null) {
      return
    }
    setBusy(true)
    setFailure(null)
    try {
      const { appointment: updated } = await bookingsApi.reschedule(appointment.id, slot.id)
      onRescheduled(updated)
    } catch (cause) {
      const described = describeBookingError(cause)
      setFailure(described)
      if (described.slotFull) {
        setSlot(null)
        setRefreshKey((key) => key + 1)
      }
      setBusy(false)
    }
  }

  return (
    <Dialog
      title="Reschedule appointment"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn--outline" onClick={onClose} disabled={busy}>
            Close
          </button>
          <button type="button" className="btn btn--primary" onClick={() => void confirm()} disabled={slot === null || busy} aria-busy={busy}>
            {busy ? 'Saving…' : 'Confirm new time'}
          </button>
        </>
      }
    >
      <p>
        {appointment.scan_type.name}. Currently {describeAppointmentTime(appointment)} at {appointment.branch.name}.
      </p>
      {failure !== null ? <FormAlert>{failure.fields.slot_id ?? failure.message}</FormAlert> : null}
      {failure?.slotFull && failure.suggestion !== null ? (
        <SuggestionBanner suggestion={failure.suggestion} currentBranchId={branchId} title="This time was just taken" onAccept={apply} />
      ) : null}
      <SlotPicker
        branchId={branchId}
        branchName={branchName}
        scanTypeId={appointment.scan_type.id}
        date={date}
        slotId={slot?.id ?? null}
        excludeSlotId={appointment.slot.id}
        refreshKey={refreshKey}
        onDateChange={(next) => {
          setDate(next)
          setSlot(null)
        }}
        onSlotChange={setSlot}
        onSwitchBranch={apply}
      />
      {slot !== null ? (
        <p className="field__hint" role="status">
          New time: {formatDate(slot.date)}, {formatSlotRange(slot)} at {branchName}
        </p>
      ) : null}
    </Dialog>
  )
}

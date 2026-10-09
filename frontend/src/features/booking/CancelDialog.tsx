import { useState } from 'react'
import { bookingsApi } from '../../api/bookings'
import { Dialog } from '../../components/Dialog'
import { FormAlert } from '../../components/form/FormAlert'
import { describeAppointmentTime, describeBookingError, notesProblem } from '../../lib/booking'
import type { Appointment } from '../../types/booking'

export interface CancelDialogProps {
  appointment: Appointment
  onClose: () => void
  onCancelled: (appointment: Appointment) => void
}

export function CancelDialog({ appointment, onClose, onCancelled }: CancelDialogProps) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reasonError = notesProblem(reason)

  const confirm = async () => {
    if (reasonError !== null) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { appointment: updated } = await bookingsApi.cancel(appointment.id, reason.trim() === '' ? undefined : reason.trim())
      onCancelled(updated)
    } catch (cause) {
      const failure = describeBookingError(cause)
      setError(failure.fields.reason ?? failure.message)
      setBusy(false)
    }
  }

  return (
    <Dialog
      title="Cancel this appointment?"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn--outline" onClick={onClose} disabled={busy}>
            Keep appointment
          </button>
          <button type="button" className="btn btn--danger" onClick={() => void confirm()} disabled={busy || reasonError !== null} aria-busy={busy}>
            {busy ? 'Cancelling…' : 'Cancel appointment'}
          </button>
        </>
      }
    >
      <p>
        {appointment.scan_type.name} at {appointment.branch.name}, {describeAppointmentTime(appointment)}. Reference {appointment.reference_code}.
      </p>
      {error !== null ? <FormAlert>{error}</FormAlert> : null}
      <div className={`field${reasonError !== null ? ' field--invalid' : ''}`}>
        <label htmlFor="cancel-reason" className="field__label">
          Reason (optional)
        </label>
        <textarea
          id="cancel-reason"
          className="field__input"
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          aria-invalid={reasonError !== null}
          aria-describedby={reasonError !== null ? 'cancel-reason-error' : undefined}
        />
        {reasonError !== null ? (
          <p id="cancel-reason-error" className="field__error" role="alert">
            {reasonError}
          </p>
        ) : null}
      </div>
    </Dialog>
  )
}

import { useState } from 'react'
import type { Appointment } from '../../types/booking'
import { CancelDialog } from './CancelDialog'
import { RescheduleDialog } from './RescheduleDialog'

export interface AppointmentActionsProps {
  appointment: Appointment
  onChanged: (appointment: Appointment) => void
  patientName?: string
}

export function AppointmentActions({ appointment, onChanged, patientName }: AppointmentActionsProps) {
  const [dialog, setDialog] = useState<'cancel' | 'reschedule' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <>
      {appointment.can_cancel || appointment.can_reschedule ? (
        <div className="appointment-card__actions">
          {appointment.can_reschedule ? (
            <button
              type="button"
              className="btn btn--outline btn--sm"
              aria-label={patientName === undefined ? undefined : `Reschedule ${patientName}`}
              onClick={() => setDialog('reschedule')}
            >
              Reschedule
            </button>
          ) : null}
          {appointment.can_cancel ? (
            <button
              type="button"
              className="btn btn--outline btn--sm"
              aria-label={patientName === undefined ? undefined : `Cancel ${patientName}`}
              onClick={() => setDialog('cancel')}
            >
              Cancel
            </button>
          ) : null}
        </div>
      ) : null}
      {notice !== null ? (
        <p className="field__hint" role="status">
          {notice}
        </p>
      ) : null}
      {dialog === 'cancel' ? (
        <CancelDialog
          appointment={appointment}
          onClose={() => setDialog(null)}
          onCancelled={(updated) => {
            setDialog(null)
            setNotice('Appointment cancelled.')
            onChanged(updated)
          }}
        />
      ) : null}
      {dialog === 'reschedule' ? (
        <RescheduleDialog
          appointment={appointment}
          onClose={() => setDialog(null)}
          onRescheduled={(updated) => {
            setDialog(null)
            setNotice('Appointment rescheduled.')
            onChanged(updated)
          }}
        />
      ) : null}
    </>
  )
}

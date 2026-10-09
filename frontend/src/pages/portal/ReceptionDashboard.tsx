import { useCallback, useEffect, useState } from 'react'
import { StaffAlertsBoard } from '../../features/alerts/StaffAlertsBoard'
import { bookingsApi } from '../../api/bookings'
import { Dialog } from '../../components/Dialog'
import { FormAlert } from '../../components/form/FormAlert'
import { PageLoader } from '../../components/PageLoader'
import { StatusBadge } from '../../features/booking/AppointmentCard'
import { usePublicResource } from '../../hooks/usePublicResource'
import { describeBookingError, formatDate, formatSlotRange, todayIso } from '../../lib/booking'
import { URGENCIES, type Appointment, type StatusUpdate, type Urgency } from '../../types/booking'

type StatusAction = 'checked_in' | 'completed' | 'no_show'

const ACTION_LABEL: Record<StatusAction, string> = {
  checked_in: 'Check in',
  completed: 'Complete',
  no_show: 'No-show',
}

export function actionsFor(status: Appointment['status']): StatusAction[] {
  if (status === 'pending' || status === 'confirmed') {
    return ['checked_in', 'no_show']
  }
  if (status === 'checked_in' || status === 'in_progress') {
    return ['completed']
  }
  return []
}

interface RowProps {
  appointment: Appointment
  onUpdated: (appointment: Appointment) => void
}

export function ReceptionRow({ appointment, onUpdated }: RowProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmNoShow, setConfirmNoShow] = useState(false)

  const apply = async (update: StatusUpdate) => {
    setBusy(true)
    setError(null)
    try {
      const { appointment: updated } = await bookingsApi.updateStatus(appointment.id, update)
      onUpdated(updated)
    } catch (cause) {
      const failure = describeBookingError(cause)
      setError(failure.fields.status ?? failure.fields.urgency ?? failure.message)
    } finally {
      setBusy(false)
      setConfirmNoShow(false)
    }
  }

  const urgencyEditable = appointment.status !== 'cancelled' && appointment.status !== 'no_show' && appointment.status !== 'completed'
  const attention = appointment.attention ?? []
  const actions = actionsFor(appointment.status)

  return (
    <li className={`reception-row${appointment.needs_attention ? ' reception-row--attention' : ''}`}>
      <div className="reception-row__time">
        <strong>{formatSlotRange(appointment.slot)}</strong>
        <StatusBadge status={appointment.status} />
      </div>
      <div className="reception-row__main">
        <h3 className="reception-row__patient">{appointment.patient.full_name}</h3>
        <p className="reception-row__meta">
          {appointment.scan_type.name} · {appointment.branch.name} · {appointment.reference_code}
          {appointment.patient.phone ? ` · ${appointment.patient.phone}` : ''}
        </p>
        {appointment.needs_attention ? (
          <div className="attention-flag" role="note">
            <strong>Needs attention</strong>
            <ul>
              {attention.map((flag) => (
                <li key={flag.code}>
                  {flag.question} <strong>{flag.answer}</strong>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {error !== null ? <FormAlert>{error}</FormAlert> : null}
      </div>
      <div className="reception-row__controls">
        <label className="reception-row__urgency">
          <span className="field__label">Urgency</span>
          <select
            className={`field__input urgency urgency--${appointment.urgency.toLowerCase()}`}
            value={appointment.urgency}
            disabled={busy || !urgencyEditable}
            aria-label={`Urgency for ${appointment.patient.full_name}`}
            onChange={(event) => void apply({ urgency: event.target.value as Urgency })}
          >
            {URGENCIES.map((urgency) => (
              <option key={urgency} value={urgency}>
                {urgency}
              </option>
            ))}
          </select>
        </label>
        <div className="reception-row__buttons">
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              className={action === 'no_show' ? 'btn btn--outline btn--sm' : 'btn btn--primary btn--sm'}
              disabled={busy}
              aria-label={`${ACTION_LABEL[action]} ${appointment.patient.full_name}`}
              onClick={() => (action === 'no_show' ? setConfirmNoShow(true) : void apply({ status: action }))}
            >
              {ACTION_LABEL[action]}
            </button>
          ))}
        </div>
      </div>
      {confirmNoShow ? (
        <Dialog
          title="Mark as no-show?"
          onClose={() => setConfirmNoShow(false)}
          busy={busy}
          footer={
            <>
              <button type="button" className="btn btn--outline" onClick={() => setConfirmNoShow(false)} disabled={busy}>
                Go back
              </button>
              <button type="button" className="btn btn--danger" onClick={() => void apply({ status: 'no_show' })} disabled={busy}>
                Mark no-show
              </button>
            </>
          }
        >
          <p>
            {appointment.patient.full_name} did not arrive for {appointment.scan_type.name} at {formatSlotRange(appointment.slot)}. This cannot be undone.
          </p>
        </Dialog>
      ) : null}
    </li>
  )
}

export default function ReceptionDashboard() {
  const branches = usePublicResource('branches')
  const [date, setDate] = useState(todayIso())
  const [branchId, setBranchId] = useState('')
  const [items, setItems] = useState<Appointment[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const response = await bookingsApi.listForStaff({ date, branch_id: branchId || undefined, per_page: 100 })
      setItems(response.appointments)
    } catch (cause) {
      setItems(null)
      setError(describeBookingError(cause).message)
    }
  }, [date, branchId])

  useEffect(() => {
    setItems(null)
    void load()
  }, [load])

  const replace = (updated: Appointment) => {
    setItems((previous) => (previous === null ? previous : previous.map((item) => (item.id === updated.id ? updated : item))))
  }

  const flagged = items?.filter((item) => item.needs_attention).length ?? 0

  return (
    <section aria-labelledby="dashboard-title">
      <h1 id="dashboard-title">Reception dashboard</h1>
      <div className="toolbar reception-filters">
        <div className="field">
          <label htmlFor="reception-date" className="field__label">
            Date
          </label>
          <input id="reception-date" type="date" className="field__input" value={date} onChange={(event) => event.target.value && setDate(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="reception-branch" className="field__label">
            Branch
          </label>
          <select id="reception-branch" className="field__input" value={branchId} onChange={(event) => setBranchId(event.target.value)}>
            <option value="">All branches</option>
            {(branches.data?.branches ?? []).map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn--outline btn--sm" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {error !== null ? <FormAlert>{error}</FormAlert> : null}
      {items === null && error === null ? <PageLoader label="Loading appointments…" /> : null}
      {items !== null ? (
        <>
          <p className="results-count" role="status">
            {items.length} {items.length === 1 ? 'appointment' : 'appointments'} on {formatDate(date)}
            {flagged > 0 ? `, ${flagged} need attention` : ''}
          </p>
          {items.length === 0 ? (
            <p>No appointments for this date and branch.</p>
          ) : (
            <ul className="reception-list" aria-label="Appointments">
              {items.map((appointment) => (
                <ReceptionRow key={appointment.id} appointment={appointment} onUpdated={replace} />
              ))}
            </ul>
          )}
        </>
      ) : null}
      <StaffAlertsBoard canResolve />
    </section>
  )
}

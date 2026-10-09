import { useCallback, useEffect, useState } from 'react'
import { alertsApi } from '../../api/alerts'
import { ApiError } from '../../api/client'
import { FlagIcon } from '../../components/icons/Icons'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FormAlert } from '../../components/form/FormAlert'
import { useApiQuery } from '../../hooks/useApi'
import { actorOf, describeEvent } from '../../lib/alerts'
import type { AlertEventItem, StaffAlert } from '../../types/alerts'
import '../../styles/alerts.css'

const REFRESH_MS = 30000

const FILTERS = [
  { value: 'active', label: 'Unresolved' },
  { value: 'flagged', label: 'Red flagged only' },
  { value: 'all', label: 'All alerts' },
]

function formatTime(value: string | null): string {
  return value === null ? '' : new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function Timeline({ alertId }: { alertId: string }) {
  const load = useCallback(() => alertsApi.events(alertId), [alertId])
  const { data, error, loading } = useApiQuery(load, [load])
  if (loading && data === null) return <p>Loading the audit trail…</p>
  if (error !== null) return <FormAlert>{error.message}</FormAlert>
  const events: AlertEventItem[] = data?.events ?? []
  return (
    <ol className="timeline" aria-label="Alert audit trail">
      {events.map((event) => (
        <li key={event.id} className={`timeline__item timeline__item--${event.event_type}`}>
          <time dateTime={event.created_at}>{formatTime(event.created_at)}</time>
          <span className="timeline__what">{describeEvent(event)}</span>
          <span className="timeline__who">{actorOf(event)}</span>
          {typeof event.details.note === 'string' ? <span className="timeline__note">Note: {event.details.note}</span> : null}
        </li>
      ))}
    </ol>
  )
}

export function StaffAlertsBoard({ canResolve }: { canResolve: boolean }) {
  const [filter, setFilter] = useState('active')
  const load = useCallback(
    () => alertsApi.list(filter === 'flagged' ? { status: 'active', flagged: true } : { status: filter }),
    [filter],
  )
  const { data, error, loading, reload } = useApiQuery(load, [load])
  const [openTimeline, setOpenTimeline] = useState<string | null>(null)
  const [target, setTarget] = useState<StaffAlert | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => {
      void reload()
    }, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [reload])

  const close = () => {
    setTarget(null)
    setNote('')
    setDialogError(null)
  }

  const resolve = async () => {
    if (target === null) return
    setBusy(true)
    setDialogError(null)
    try {
      await alertsApi.resolve(target.id, note.trim())
      setNotice(`Alert for ${target.patient_name} marked as resolved.`)
      close()
      void reload()
    } catch (cause) {
      setDialogError(cause instanceof ApiError ? cause.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const alerts = data?.alerts ?? []

  return (
    <div className="card">
      <div className="card__heading">
        <h2>Critical finding alerts</h2>
        <label className="inline-field">
          <span>Show</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value)} className="field__input">
            {FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {notice !== null ? <FormAlert tone="success">{notice}</FormAlert> : null}
      {error !== null ? <FormAlert>{error.message}</FormAlert> : null}
      {data === null && loading ? <p>Loading alerts…</p> : null}
      {data !== null && alerts.length === 0 ? <p>No alerts to show.</p> : null}
      {alerts.length > 0 ? (
        <div className="table-scroll">
          <table className="data-table">
            <caption className="sr-only">Critical finding alerts, red flagged first</caption>
            <thead>
              <tr>
                <th scope="col">Status</th>
                <th scope="col">Patient</th>
                <th scope="col">Scan</th>
                <th scope="col">Raised</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert.id} className={alert.red_flag ? 'row--red-flag' : undefined} data-testid={`alert-row-${alert.id}`}>
                  <td>
                    {alert.red_flag ? (
                      <span className="urgency urgency--urgent">
                        <FlagIcon size={14} /> Phone patient now
                      </span>
                    ) : (
                      <span className="status-chip">{alert.status}</span>
                    )}
                    {alert.red_flag ? <span className="data-table__sub">{alert.status}</span> : null}
                  </td>
                  <td>
                    {alert.patient_name}
                    <span className="data-table__sub">{alert.reference_code}</span>
                    {alert.referrer_name !== null ? <span className="data-table__sub">Referrer: {alert.referrer_name}</span> : null}
                  </td>
                  <td>{alert.scan_name}</td>
                  <td>
                    {formatTime(alert.created_at)}
                    {alert.resolved_at !== null ? <span className="data-table__sub">Resolved {formatTime(alert.resolved_at)}</span> : null}
                  </td>
                  <td>
                    <div className="row-actions">
                      {alert.patient_phone !== null && alert.status !== 'resolved' ? (
                        <a className="btn btn--primary btn--sm" href={`tel:${alert.patient_phone}`}>
                          Phone patient
                        </a>
                      ) : null}
                      {canResolve && alert.status !== 'resolved' && alert.status !== 'cancelled' ? (
                        <button type="button" className="btn btn--outline btn--sm" onClick={() => setTarget(alert)}>
                          Resolve
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        aria-expanded={openTimeline === alert.id}
                        onClick={() => setOpenTimeline(openTimeline === alert.id ? null : alert.id)}
                      >
                        {openTimeline === alert.id ? 'Hide timeline' : 'Timeline'}
                      </button>
                    </div>
                    {openTimeline === alert.id ? <Timeline alertId={alert.id} /> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <ConfirmDialog
        open={target !== null}
        title="Resolve this alert?"
        description={target === null ? undefined : `Record how ${target.patient_name} was reached. This is added to the permanent audit trail.`}
        confirmLabel="Mark as resolved"
        busy={busy}
        confirmDisabled={note.trim().length < 3}
        error={dialogError}
        onConfirm={() => void resolve()}
        onCancel={close}
      >
        <div className="field">
          <label htmlFor="resolve-note" className="field__label">
            Call note <span aria-hidden="true">*</span>
          </label>
          <textarea
            id="resolve-note"
            className="field__input"
            rows={3}
            maxLength={500}
            required
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </ConfirmDialog>
    </div>
  )
}

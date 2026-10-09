import { useCallback, useEffect, useState } from 'react'
import { alertsApi } from '../../api/alerts'
import { ApiError } from '../../api/client'
import { useAppSelector } from '../../app/hooks'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FormAlert } from '../../components/form/FormAlert'
import { selectUser } from '../../features/auth/authSlice'
import { ReadingQueueTable } from '../../features/alerts/ReadingQueueTable'
import { useApiQuery } from '../../hooks/useApi'
import type { RecentReport } from '../../types/alerts'
import '../../styles/alerts.css'

const REFRESH_MS = 60000

function FlagCell({ report, onFlag }: { report: RecentReport; onFlag: (report: RecentReport) => void }) {
  if (report.is_critical) {
    return <span className="urgency urgency--urgent">Critical{report.alert_status !== null ? `: ${report.alert_status}` : ''}</span>
  }
  return (
    <button type="button" className="btn btn--outline btn--sm" onClick={() => onFlag(report)}>
      Flag critical
    </button>
  )
}

export default function DoctorDashboard() {
  const user = useAppSelector(selectUser)
  const load = useCallback(() => alertsApi.doctorQueue(), [])
  const { data, error, loading, reload } = useApiQuery(load, [load])
  const [target, setTarget] = useState<RecentReport | null>(null)
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

  const confirm = async () => {
    if (target === null) return
    setBusy(true)
    setDialogError(null)
    try {
      const result = await alertsApi.flagCritical(target.report_id, note.trim())
      setNotice(
        result.note_stored || note.trim() === ''
          ? `Critical alert raised for ${target.patient_name}. The patient and referring doctor have been notified.`
          : `Critical alert raised for ${target.patient_name}. Your note was not saved because encrypted note storage is not configured.`,
      )
      close()
      void reload()
    } catch (cause) {
      setDialogError(cause instanceof ApiError ? cause.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="doctor-title">
      <h1 id="doctor-title">Doctor dashboard</h1>
      <p>Welcome, {user?.full_name}.</p>
      {notice !== null ? <FormAlert tone="success">{notice}</FormAlert> : null}
      {error !== null ? <FormAlert>{error.message}</FormAlert> : null}

      <div className="card">
        <div className="card__heading">
          <h2 id="queue-title">Priority reading queue</h2>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => void reload()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {data === null ? <p>{loading ? 'Loading the queue…' : 'The queue is not available.'}</p> : <ReadingQueueTable items={data.queue} />}
      </div>

      <div className="card">
        <h2>Recent reports</h2>
        {data === null || data.recent_reports.length === 0 ? (
          <p>No reports in the last 30 days.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <caption className="sr-only">Reports from the last 30 days</caption>
              <thead>
                <tr>
                  <th scope="col">Patient</th>
                  <th scope="col">Scan</th>
                  <th scope="col">Report</th>
                  <th scope="col">Critical finding</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_reports.map((report) => (
                  <tr key={report.report_id}>
                    <td>
                      {report.patient_name}
                      <span className="data-table__sub">{report.reference_code}</span>
                    </td>
                    <td>{report.scan_name}</td>
                    <td>{report.title}</td>
                    <td>
                      <FlagCell report={report} onFlag={setTarget} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={target !== null}
        title="Flag this report as critical?"
        description={
          target === null
            ? undefined
            : `The patient (${target.patient_name}) and the referring doctor will be emailed straight away and must acknowledge the alert. If nobody acknowledges, reception is told to phone the patient.`
        }
        confirmLabel="Flag as critical"
        danger
        busy={busy}
        error={dialogError}
        onConfirm={() => void confirm()}
        onCancel={close}
      >
        <div className="field">
          <label htmlFor="critical-note" className="field__label">
            Clinical note (optional, stored encrypted, never emailed)
          </label>
          <textarea
            id="critical-note"
            className="field__input"
            rows={3}
            maxLength={1000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </ConfirmDialog>
    </section>
  )
}

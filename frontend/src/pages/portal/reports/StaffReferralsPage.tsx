import { useCallback, useState } from 'react'
import { ApiError } from '../../../api/client'
import { referralsApi } from '../../../api/referrals'
import { reportsApi } from '../../../api/reports'
import { FormAlert } from '../../../components/form/FormAlert'
import { PageLoader } from '../../../components/PageLoader'
import { REFERRAL_STATUS_LABEL } from '../../../features/referrals/ReferralList'
import { appointmentLabel } from '../../../features/reports/UploadReportForm'
import { useApiQuery } from '../../../hooks/useApi'
import { formatDate } from '../../../lib/format'
import type { Referral, ReferralStatus, UpdateReferralRequest } from '../../../types/referral'
import type { StaffAppointmentOption } from '../../../types/report'

const STAFF_STATUSES: Exclude<ReferralStatus, 'submitted'>[] = ['accepted', 'scheduled', 'completed', 'report_ready', 'declined', 'cancelled']

interface RowProps {
  referral: Referral
  appointments: StaffAppointmentOption[]
  onSaved: () => void
}

function ReferralRow({ referral, appointments, onSaved }: RowProps) {
  const [status, setStatus] = useState<string>(referral.status === 'submitted' ? '' : referral.status)
  const [appointmentId, setAppointmentId] = useState(referral.appointment?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  const changes: UpdateReferralRequest = {}
  if (status !== '' && status !== referral.status) {
    changes.status = status as Exclude<ReferralStatus, 'submitted'>
  }
  if (appointmentId !== '' && appointmentId !== (referral.appointment?.id ?? '')) {
    changes.appointment_id = appointmentId
  }
  const dirty = Object.keys(changes).length > 0

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await referralsApi.update(referral.id, changes)
      setMessage({ tone: 'success', text: 'Saved.' })
      onSaved()
    } catch (cause) {
      setMessage({ tone: 'error', text: cause instanceof ApiError ? cause.message : 'Something went wrong. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="card">
      <h3>
        {referral.patient_name} <span className="badge">{REFERRAL_STATUS_LABEL[referral.status]}</span>
      </h3>
      <p>
        {referral.scan_type?.name ?? 'Scan not specified'} · {referral.urgency} · Ref {referral.reference_code} · {formatDate(referral.created_at)}
        {referral.referrer !== undefined ? ` · from ${referral.referrer.name}` : ''}
      </p>
      {referral.clinical_notes !== null ? <p>Notes: {referral.clinical_notes}</p> : null}
      <div className="stack">
        <label>
          Status{' '}
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="field__input">
            <option value="">Choose a status</option>
            {STAFF_STATUSES.map((value) => (
              <option key={value} value={value}>
                {REFERRAL_STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Linked appointment{' '}
          <select value={appointmentId} onChange={(event) => setAppointmentId(event.target.value)} className="field__input">
            <option value="">None</option>
            {appointments.map((appointment) => (
              <option key={appointment.id} value={appointment.id}>
                {appointmentLabel(appointment)}
              </option>
            ))}
          </select>
        </label>
        {message !== null ? <FormAlert tone={message.tone}>{message.text}</FormAlert> : null}
        <button type="button" className="btn btn--primary btn--sm" disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </li>
  )
}

export default function StaffReferralsPage() {
  const loadReferrals = useCallback(() => referralsApi.list(), [])
  const loadAppointments = useCallback(() => reportsApi.staffAppointments(), [])
  const referrals = useApiQuery(loadReferrals, [loadReferrals])
  const appointments = useApiQuery(loadAppointments, [loadAppointments])

  return (
    <section aria-labelledby="staff-referrals-title">
      <h1 id="staff-referrals-title">Referrals</h1>
      {referrals.error !== null ? <FormAlert>{referrals.error.message}</FormAlert> : null}
      {referrals.loading && referrals.data === null ? <PageLoader /> : null}
      {referrals.data !== null && referrals.data.referrals.length === 0 ? (
        <div className="state-card">
          <p>No referrals have been received yet.</p>
        </div>
      ) : null}
      {referrals.data !== null ? (
        <ul className="stack" aria-label="Referrals">
          {referrals.data.referrals.map((referral) => (
            <ReferralRow
              key={referral.id}
              referral={referral}
              appointments={appointments.data?.appointments ?? []}
              onSaved={() => void referrals.reload()}
            />
          ))}
        </ul>
      ) : null}
    </section>
  )
}

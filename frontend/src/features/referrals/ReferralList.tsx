import { reportsApi } from '../../api/reports'
import { formatDate } from '../../lib/format'
import type { Referral, ReferralStatus } from '../../types/referral'

export const REFERRAL_STATUS_LABEL: Record<ReferralStatus, string> = {
  submitted: 'Submitted',
  accepted: 'Received',
  scheduled: 'Scheduled',
  completed: 'Scan completed',
  report_ready: 'Report ready',
  declined: 'Declined',
  cancelled: 'Cancelled',
}

export interface ReferralListProps {
  referrals: Referral[]
}

export function ReferralList({ referrals }: ReferralListProps) {
  if (referrals.length === 0) {
    return (
      <div className="state-card">
        <p>You have not sent any referrals yet.</p>
      </div>
    )
  }
  return (
    <ul className="stack" aria-label="Your referrals">
      {referrals.map((referral) => (
        <li key={referral.id} className="card">
          <h3>
            {referral.patient_name} <span className="badge">{REFERRAL_STATUS_LABEL[referral.status]}</span>
          </h3>
          <p>
            {referral.scan_type?.name ?? 'Scan not specified'} · {referral.urgency} · Ref {referral.reference_code} · Sent{' '}
            {formatDate(referral.created_at)}
          </p>
          {referral.appointment !== null ? (
            <p>
              Appointment {referral.appointment.reference_code} on {formatDate(referral.appointment.date)}
              {referral.appointment.time !== null ? ` at ${referral.appointment.time}` : ''}
            </p>
          ) : null}
          {referral.reports.length > 0 ? (
            <ul aria-label={`Reports for ${referral.patient_name}`}>
              {referral.reports.map((report) => (
                <li key={report.id}>
                  {report.title}{' '}
                  <a className="btn btn--outline btn--sm" href={reportsApi.downloadUrl(report.id)} download>
                    Download <span className="visually-hidden">{report.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

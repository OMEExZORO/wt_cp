import { reportsApi } from '../../api/reports'
import { formatDate } from '../../lib/format'
import { formatBytes } from '../../lib/reportFile'
import type { ReportSummary } from '../../types/report'

export interface ReportListProps {
  reports: ReportSummary[]
  showPatient?: boolean
}

const STATUS_LABEL: Record<ReportSummary['status'], string> = { draft: 'Draft', final: 'Final', amended: 'Amended' }

export function ReportList({ reports, showPatient = false }: ReportListProps) {
  if (reports.length === 0) {
    return (
      <div className="state-card">
        <p>No reports are available yet.</p>
      </div>
    )
  }
  return (
    <ul className="stack" aria-label="Reports">
      {reports.map((report) => (
        <li key={report.id} className="card">
          <h3>{report.title}</h3>
          <p>
            {report.appointment.scan_name} · {formatDate(report.appointment.date)} · Ref {report.appointment.reference_code}
            {showPatient ? ` · ${report.patient.name}` : ''}
          </p>
          <p>
            <span className="badge">{STATUS_LABEL[report.status]}</span>{' '}
            {report.is_critical ? <span className="badge">Critical</span> : null} {report.mime_type === 'application/pdf' ? 'PDF' : 'Image'},{' '}
            {formatBytes(report.size_bytes)}, uploaded {formatDate(report.created_at)}
          </p>
          <a className="btn btn--outline btn--sm" href={reportsApi.downloadUrl(report.id)} download>
            Download <span className="visually-hidden">{report.title}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

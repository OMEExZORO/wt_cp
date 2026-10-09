import { formatWaiting, sortQueue, WAIT_LABEL, WAIT_SYMBOL } from '../../lib/alerts'
import type { QueueItem } from '../../types/alerts'
import '../../styles/alerts.css'

export interface ReadingQueueTableProps {
  items: QueueItem[]
}

export function UrgencyBadge({ urgency }: { urgency: QueueItem['urgency'] }) {
  return <span className={`urgency urgency--${urgency.toLowerCase()}`}>{urgency}</span>
}

export function WaitIndicator({ minutes, level }: { minutes: number; level: QueueItem['wait_level'] }) {
  return (
    <span className={`wait wait--${level}`}>
      <span aria-hidden="true">{WAIT_SYMBOL[level]}</span> {formatWaiting(minutes)} <span className="wait__label">({WAIT_LABEL[level]})</span>
    </span>
  )
}

export function ReadingQueueTable({ items }: ReadingQueueTableProps) {
  if (items.length === 0) {
    return <p>No scans are waiting to be reported.</p>
  }
  const rows = sortQueue(items)
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="sr-only">Scans waiting for a report, most urgent first</caption>
        <thead>
          <tr>
            <th scope="col">Urgency</th>
            <th scope="col">Patient</th>
            <th scope="col">Scan</th>
            <th scope="col">Branch</th>
            <th scope="col">Waiting</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.appointment_id}>
              <td>
                <UrgencyBadge urgency={item.urgency} />
              </td>
              <td>
                {item.patient_name}
                <span className="data-table__sub">{item.reference_code}</span>
              </td>
              <td>{item.scan_name}</td>
              <td>{item.branch_name}</td>
              <td>
                <WaitIndicator minutes={item.waiting_minutes} level={item.wait_level} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

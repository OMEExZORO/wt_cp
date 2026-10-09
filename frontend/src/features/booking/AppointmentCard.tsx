import { Link } from 'react-router-dom'
import { STATUS_LABEL, describeAppointmentTime } from '../../lib/booking'
import type { Appointment } from '../../types/booking'
import { AppointmentActions } from './AppointmentActions'

export function StatusBadge({ status }: { status: Appointment['status'] }) {
  return <span className={`status-badge status-badge--${status}`}>{STATUS_LABEL[status]}</span>
}

export interface AppointmentCardProps {
  appointment: Appointment
  onChanged: (appointment: Appointment) => void
}

export function AppointmentCard({ appointment, onChanged }: AppointmentCardProps) {
  return (
    <li className="appointment-card">
      <div className="appointment-card__head">
        <h3 className="appointment-card__title">{appointment.scan_type.name}</h3>
        <StatusBadge status={appointment.status} />
      </div>
      <p className="appointment-card__when">{describeAppointmentTime(appointment)}</p>
      <p className="appointment-card__meta">
        {appointment.branch.name} · Reference {appointment.reference_code}
      </p>
      <div className="appointment-card__links">
        <Link to={`/portal/patient/appointments/${appointment.id}`}>View details</Link>
      </div>
      <AppointmentActions appointment={appointment} onChanged={onChanged} />
    </li>
  )
}

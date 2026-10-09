import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { bookingsApi } from '../../api/bookings'
import { FormAlert } from '../../components/form/FormAlert'
import { PageLoader } from '../../components/PageLoader'
import { AppointmentActions } from '../../features/booking/AppointmentActions'
import { StatusBadge } from '../../features/booking/AppointmentCard'
import { describeAppointmentTime, describeBookingError } from '../../lib/booking'
import type { Appointment } from '../../types/booking'

interface LocationState {
  confirmed?: boolean
  emailSent?: boolean
}

export default function AppointmentPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const state = (location.state ?? {}) as LocationState
  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let cancelled = false
    setAppointment(null)
    setError(null)
    bookingsApi
      .get(id)
      .then((response) => {
        if (!cancelled) {
          setAppointment(response.appointment)
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(describeBookingError(cause).message)
        }
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (appointment !== null) {
      headingRef.current?.focus()
    }
  }, [appointment?.id])

  if (error !== null) {
    return (
      <section aria-labelledby="appointment-title">
        <h1 id="appointment-title">Appointment</h1>
        <FormAlert>{error}</FormAlert>
        <Link to="/portal/patient">Back to your dashboard</Link>
      </section>
    )
  }
  if (appointment === null) {
    return <PageLoader label="Loading your appointment…" />
  }

  const active = appointment.status === 'pending' || appointment.status === 'confirmed'
  const flagged = (appointment.checklist ?? []).filter((answer) => answer.needs_attention)

  return (
    <section aria-labelledby="appointment-title" className="appointment-detail">
      <h1 id="appointment-title" ref={headingRef} tabIndex={-1}>
        {state.confirmed === true ? 'Your appointment is booked' : 'Appointment details'}
      </h1>
      {state.confirmed === true ? (
        <FormAlert tone="success">
          Booking reference <strong>{appointment.reference_code}</strong>.{' '}
          {state.emailSent === true ? 'We have emailed you the details.' : 'Keep this reference for your visit.'}
        </FormAlert>
      ) : null}

      <div className="card">
        <p>
          <StatusBadge status={appointment.status} />
        </p>
        <dl className="details">
          <dt>Reference</dt>
          <dd>{appointment.reference_code}</dd>
          <dt>Scan</dt>
          <dd>{appointment.scan_type.name}</dd>
          <dt>When</dt>
          <dd>{describeAppointmentTime(appointment)}</dd>
          <dt>Where</dt>
          <dd>
            {appointment.branch.address}
            {appointment.branch.maps_url !== null ? (
              <>
                {' '}
                <a href={appointment.branch.maps_url} target="_blank" rel="noopener noreferrer">
                  Open map
                </a>
              </>
            ) : null}
          </dd>
          {appointment.branch.phone !== null ? (
            <>
              <dt>Branch phone</dt>
              <dd>{appointment.branch.phone}</dd>
            </>
          ) : null}
          {appointment.cancellation_reason ? (
            <>
              <dt>Cancellation reason</dt>
              <dd>{appointment.cancellation_reason}</dd>
            </>
          ) : null}
        </dl>
      </div>

      <div className="card prep">
        <h2>How to prepare</h2>
        <p>{appointment.scan_type.preparation_tips}</p>
        <p>Please bring your doctor&apos;s referral, previous reports and a photo ID.</p>
      </div>

      {flagged.length > 0 ? (
        <FormAlert tone="info">The centre has noted some of your safety answers and may call you before the scan.</FormAlert>
      ) : null}

      {active ? (
        <div className="card">
          <h2>Add to your calendar</h2>
          <div className="appointment-card__actions">
            <a className="btn btn--outline btn--sm" href={bookingsApi.icsUrl(appointment.id)} download>
              Download .ics file
            </a>
            {appointment.calendar.google_url !== null ? (
              <a className="btn btn--outline btn--sm" href={appointment.calendar.google_url} target="_blank" rel="noopener noreferrer">
                Add to Google Calendar
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <AppointmentActions appointment={appointment} onChanged={setAppointment} />

      <p>
        <Link to="/portal/patient">Back to your dashboard</Link>
      </p>
    </section>
  )
}

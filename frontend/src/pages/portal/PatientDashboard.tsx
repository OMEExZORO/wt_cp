import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { bookingsApi } from '../../api/bookings'
import { useAppSelector } from '../../app/hooks'
import { FormAlert } from '../../components/form/FormAlert'
import { PageLoader } from '../../components/PageLoader'
import { selectUser } from '../../features/auth/authSlice'
import { AppointmentCard } from '../../features/booking/AppointmentCard'
import { describeBookingError } from '../../lib/booking'
import type { Appointment } from '../../types/booking'

interface Lists {
  upcoming: Appointment[]
  past: Appointment[]
}

export default function PatientDashboard() {
  const user = useAppSelector(selectUser)
  const [lists, setLists] = useState<Lists | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [upcoming, past] = await Promise.all([bookingsApi.list('upcoming'), bookingsApi.list('past')])
      setLists({ upcoming: upcoming.appointments, past: past.appointments })
      setError(null)
    } catch (cause) {
      setError(describeBookingError(cause).message)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const changed = (appointment: Appointment) => {
    setNotice(
      appointment.status === 'cancelled'
        ? `Appointment ${appointment.reference_code} was cancelled.`
        : `Appointment ${appointment.reference_code} was moved to the new time.`,
    )
    void load()
  }

  return (
    <section aria-labelledby="dashboard-title">
      <h1 id="dashboard-title">Patient dashboard</h1>
      <p>Welcome, {user?.full_name}.</p>
      <p>
        <Link to="/portal/patient/book" className="btn btn--primary">
          Book an appointment
        </Link>
      </p>
      {notice !== null ? <FormAlert tone="success">{notice}</FormAlert> : null}
      {error !== null ? (
        <FormAlert>
          {error}{' '}
          <button type="button" className="link-button" onClick={() => void load()}>
            Try again
          </button>
        </FormAlert>
      ) : null}
      {lists === null && error === null ? <PageLoader label="Loading your appointments…" /> : null}
      {lists !== null ? (
        <>
          <h2>Upcoming appointments</h2>
          {lists.upcoming.length === 0 ? (
            <p>You have no upcoming appointments.</p>
          ) : (
            <ul className="appointment-list" aria-label="Upcoming appointments">
              {lists.upcoming.map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} onChanged={changed} />
              ))}
            </ul>
          )}
          <h2>Past appointments</h2>
          {lists.past.length === 0 ? (
            <p>Your past appointments will appear here.</p>
          ) : (
            <ul className="appointment-list" aria-label="Past appointments">
              {lists.past.map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} onChanged={changed} />
              ))}
            </ul>
          )}
        </>
      ) : null}
    </section>
  )
}

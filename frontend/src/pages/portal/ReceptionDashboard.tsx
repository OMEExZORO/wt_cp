import { useAppSelector } from '../../app/hooks'
import { StaffAlertsBoard } from '../../features/alerts/StaffAlertsBoard'
import { selectUser } from '../../features/auth/authSlice'

export default function ReceptionDashboard() {
  const user = useAppSelector(selectUser)
  return (
    <section aria-labelledby="reception-title">
      <h1 id="reception-title">Reception dashboard</h1>
      <p>Welcome, {user?.full_name}.</p>
      <StaffAlertsBoard canResolve />
    </section>
  )
}

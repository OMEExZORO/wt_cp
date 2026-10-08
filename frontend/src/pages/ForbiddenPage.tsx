import { Link } from 'react-router-dom'
import { useAppSelector } from '../app/hooks'
import { selectUser } from '../features/auth/authSlice'
import { homeFor } from '../lib/roles'

export default function ForbiddenPage() {
  const user = useAppSelector(selectUser)
  return (
    <section className="container" aria-labelledby="forbidden-title">
      <h1 id="forbidden-title">Access denied</h1>
      <p>You do not have permission to view this page.</p>
      {user !== null ? <Link to={homeFor(user.role)}>Go to your dashboard</Link> : <Link to="/login">Sign in</Link>}
    </section>
  )
}

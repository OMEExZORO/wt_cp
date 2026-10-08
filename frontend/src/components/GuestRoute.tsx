import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAppSelector } from '../app/hooks'
import { selectAuth } from '../features/auth/authSlice'
import { canVisit, homeFor } from '../lib/roles'
import { PageLoader } from './PageLoader'

export function GuestRoute() {
  const { status, user } = useAppSelector(selectAuth)
  const location = useLocation()
  if (status === 'idle' || status === 'loading') {
    return <PageLoader label="Checking your session…" />
  }
  if (user !== null) {
    const from = (location.state as { from?: unknown } | null)?.from
    const target = typeof from === 'string' && canVisit(user.role, from) ? from : homeFor(user.role)
    return <Navigate to={target} replace />
  }
  return <Outlet />
}

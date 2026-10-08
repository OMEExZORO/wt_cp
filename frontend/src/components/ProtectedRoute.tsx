import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAppSelector } from '../app/hooks'
import { selectAuth } from '../features/auth/authSlice'
import type { Role } from '../types/auth'
import { PageLoader } from './PageLoader'

export interface ProtectedRouteProps {
  roles?: Role[]
}

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const { status, user } = useAppSelector(selectAuth)
  const location = useLocation()

  if (status === 'idle' || status === 'loading') {
    return <PageLoader label="Checking your session…" />
  }
  if (user === null) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  if (roles !== undefined && !roles.includes(user.role)) {
    return <Navigate to="/403" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

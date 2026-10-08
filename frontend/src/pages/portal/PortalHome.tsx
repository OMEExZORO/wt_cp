import { Navigate } from 'react-router-dom'
import { useAppSelector } from '../../app/hooks'
import { selectUser } from '../../features/auth/authSlice'
import { homeFor } from '../../lib/roles'

export default function PortalHome() {
  const user = useAppSelector(selectUser)
  return <Navigate to={user !== null ? homeFor(user.role) : '/login'} replace />
}

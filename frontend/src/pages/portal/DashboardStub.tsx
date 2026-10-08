import { useCallback } from 'react'
import { authApi } from '../../api/auth'
import { useAppSelector } from '../../app/hooks'
import { FormAlert } from '../../components/form/FormAlert'
import { selectUser } from '../../features/auth/authSlice'
import { useApiQuery } from '../../hooks/useApi'
import type { Role } from '../../types/auth'

export interface DashboardStubProps {
  area: Role
  title: string
  upcoming: string[]
}

export function DashboardStub({ area, title, upcoming }: DashboardStubProps) {
  const user = useAppSelector(selectUser)
  const load = useCallback(() => authApi.dashboard(area), [area])
  const { error } = useApiQuery(load, [load])

  return (
    <section aria-labelledby="dashboard-title">
      <h1 id="dashboard-title">{title}</h1>
      <p>Welcome, {user?.full_name}.</p>
      {error !== null ? <FormAlert>{error.message}</FormAlert> : null}
      <div className="card">
        <h2>Coming soon</h2>
        <ul>
          {upcoming.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}

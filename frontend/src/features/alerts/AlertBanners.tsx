import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { selectUser } from '../auth/authSlice'
import { acknowledgeAlert, fetchMyAlerts } from './alertsSlice'
import '../../styles/alerts.css'

export interface AlertBannersProps {
  intervalMs?: number
}

export function AlertBanners({ intervalMs = 60000 }: AlertBannersProps) {
  const dispatch = useAppDispatch()
  const user = useAppSelector(selectUser)
  const items = useAppSelector((state) => state.alerts.items)
  const acknowledging = useAppSelector((state) => state.alerts.acknowledging)
  const error = useAppSelector((state) => state.alerts.error)
  const eligible = user !== null && (user.role === 'patient' || user.role === 'referrer')

  useEffect(() => {
    if (!eligible) return undefined
    void dispatch(fetchMyAlerts())
    const timer = window.setInterval(() => {
      void dispatch(fetchMyAlerts())
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [eligible, intervalMs, dispatch])

  if (!eligible || items.length === 0) return null

  return (
    <section aria-label="Critical finding alerts" className="critical-banners">
      {items.map((item) => {
        const busy = acknowledging.includes(item.id)
        return (
          <div key={item.id} role="alert" className="critical-banner">
            <div className="critical-banner__body">
              <strong className="critical-banner__title">{item.title}</strong>
              <p>{item.message}</p>
              <p className="critical-banner__meta">
                Reference {item.reference_code}
                {item.patient_name !== null ? ` · Patient ${item.patient_name}` : ''}
              </p>
            </div>
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void dispatch(acknowledgeAlert(item.id))}>
              {busy ? 'Acknowledging…' : 'Acknowledge'}
            </button>
          </div>
        )
      })}
      {error !== null ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}

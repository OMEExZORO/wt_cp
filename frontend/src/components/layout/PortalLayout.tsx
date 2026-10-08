import { Suspense, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { authApi } from '../../api/auth'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { logout, selectUser } from '../../features/auth/authSlice'
import { AREA_ROLES, ROLE_LABEL } from '../../lib/roles'
import { ErrorBoundary } from '../ErrorBoundary'
import { PageLoader } from '../PageLoader'
import { SiteFooter } from './SiteFooter'

const AREA_LINKS: { to: string; label: string }[] = [
  { to: '/portal/patient', label: 'Patient dashboard' },
  { to: '/portal/doctor', label: 'Doctor dashboard' },
  { to: '/portal/reception', label: 'Reception dashboard' },
  { to: '/portal/admin', label: 'Admin dashboard' },
  { to: '/portal/referrer', label: 'Referrer dashboard' },
]

function VerifyEmailBanner() {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const resend = async () => {
    setState('sending')
    try {
      await authApi.resendVerification()
      setState('sent')
    } catch {
      setState('error')
    }
  }
  return (
    <div className="alert alert--info" role="status">
      Please verify your email address. We sent you a link when you registered.{' '}
      {state === 'sent' ? (
        <strong>A new link is on its way.</strong>
      ) : (
        <button type="button" className="link-button" onClick={() => void resend()} disabled={state === 'sending'}>
          {state === 'error' ? 'Could not send. Try again' : 'Send a new link'}
        </button>
      )}
    </div>
  )
}

export function PortalLayout() {
  const user = useAppSelector(selectUser)
  const dispatch = useAppDispatch()
  if (user === null) {
    return null
  }
  const links = AREA_LINKS.filter((link) => AREA_ROLES[link.to]?.includes(user.role))

  return (
    <div className="portal">
      <header className="portal__header">
        <div className="container portal__header-inner">
          <NavLink to="/" className="site-header__brand">
            Meghnad Diagnostic Centre
          </NavLink>
          <div className="portal__user">
            <span>
              {user.full_name} <span className="badge">{ROLE_LABEL[user.role]}</span>
            </span>
            <button type="button" className="btn btn--ghost" onClick={() => void dispatch(logout())}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <div className="container portal__body">
        <nav aria-label="Portal" className="portal__nav">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to}>
              {link.label}
            </NavLink>
          ))}
          <NavLink to="/portal/account">My account</NavLink>
        </nav>
        <main id="main" className="portal__main">
          {!user.email_verified ? <VerifyEmailBanner /> : null}
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <SiteFooter />
    </div>
  )
}

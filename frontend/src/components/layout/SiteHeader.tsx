import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { useTheme } from '../../context/ThemeContext'
import { logout, selectUser } from '../../features/auth/authSlice'
import { selectSetting } from '../../features/public/publicSlice'
import { settingText } from '../../lib/contact'
import { homeFor } from '../../lib/roles'
import { Logo } from '../brand/Logo'
import { CloseIcon, MenuIcon, MoonIcon, SunIcon } from '../icons/Icons'

const LINKS: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/services', label: 'Services' },
  { to: '/about', label: 'Radiologist' },
  { to: '/branches', label: 'Centres' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
]

export function SiteHeader() {
  const user = useAppSelector(selectUser)
  const logo = settingText(useAppSelector(selectSetting('clinic.logo_url')))
  const dispatch = useAppDispatch()
  const { theme, toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const location = useLocation()

  const close = useCallback(() => {
    setOpen(false)
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!open) {
      return undefined
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link to="/" className="site-header__brand" aria-label="Meghnad Diagnostic Centre, home">
          <Logo src={logo} compact />
        </Link>
        <button
          type="button"
          ref={toggleRef}
          className="icon-btn site-header__toggle"
          aria-expanded={open}
          aria-controls="primary-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
        <div id="primary-nav" className={`site-header__panel${open ? ' site-header__panel--open' : ''}`}>
          <nav aria-label="Main" className="site-header__nav">
            {LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} onClick={close}>
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="site-header__actions">
            {user === null ? (
              <Link to="/login" className="site-header__signin" onClick={close}>
                Sign in
              </Link>
            ) : (
              <>
                <Link to={homeFor(user.role)} className="site-header__signin" onClick={close}>
                  My portal
                </Link>
                <button type="button" className="site-header__signin site-header__linkbtn" onClick={() => void dispatch(logout())}>
                  Sign out
                </button>
              </>
            )}
            <button
              type="button"
              className="icon-btn"
              onClick={toggleTheme}
              aria-pressed={theme === 'dark'}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <Link to="/book" className="btn btn--primary btn--sm" onClick={close}>
              Book Appointment
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}

import { Link, NavLink } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { useTheme } from '../../context/ThemeContext'
import { logout, selectUser } from '../../features/auth/authSlice'
import { homeFor } from '../../lib/roles'

export function SiteHeader() {
  const user = useAppSelector(selectUser)
  const dispatch = useAppDispatch()
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link to="/" className="site-header__brand">
          Meghnad Diagnostic Centre
        </Link>
        <nav aria-label="Main" className="site-header__nav">
          <NavLink to="/" end>
            Home
          </NavLink>
          {user === null ? (
            <>
              <NavLink to="/login">Sign in</NavLink>
              <NavLink to="/register">Register</NavLink>
            </>
          ) : (
            <>
              <NavLink to={homeFor(user.role)}>My portal</NavLink>
              <button type="button" className="link-button" onClick={() => void dispatch(logout())}>
                Sign out
              </button>
            </>
          )}
          <button
            type="button"
            className="link-button"
            onClick={toggleTheme}
            aria-pressed={theme === 'dark'}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </nav>
      </div>
    </header>
  )
}

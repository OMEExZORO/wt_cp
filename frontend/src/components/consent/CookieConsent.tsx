import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  OPEN_COOKIE_SETTINGS_EVENT,
  readCookieConsent,
  storeCookieConsent,
  type CookieChoice,
} from '../../lib/consent'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (readCookieConsent() === null) {
      setVisible(true)
    }
  }, [])

  useEffect(() => {
    const reopen = (): void => setVisible(true)
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen)
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen)
  }, [])

  const choose = useCallback((choice: CookieChoice) => {
    storeCookieConsent(choice)
    setVisible(false)
  }, [])

  if (!visible) {
    return null
  }

  return (
    <div className="cookie-banner" role="region" aria-labelledby="cookie-banner-title">
      <div className="cookie-banner__card">
        <div className="cookie-banner__copy">
          <h2 id="cookie-banner-title" className="cookie-banner__title">
            Cookies on this site
          </h2>
          <p className="cookie-banner__text">
            We use essential cookies to keep you signed in, protect forms and remember your display choice. The
            optional &ldquo;remember me&rdquo; cookie is set only if you choose it at sign in. We use no advertising
            cookies. See the <Link to="/privacy">privacy policy</Link> for details.
          </p>
        </div>
        <div className="cookie-banner__actions">
          <button type="button" className="btn btn--primary btn--sm" onClick={() => choose('all')}>
            Accept all
          </button>
          <button type="button" className="btn btn--outline btn--sm" onClick={() => choose('essential')}>
            Essential only
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => choose('rejected')}>
            Reject
          </button>
        </div>
      </div>
    </div>
  )
}

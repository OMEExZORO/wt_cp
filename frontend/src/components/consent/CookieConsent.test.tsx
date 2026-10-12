import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { CookieConsent } from './CookieConsent'
import { OPEN_COOKIE_SETTINGS_EVENT, readCookieConsent } from '../../lib/consent'

function renderBanner() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <CookieConsent />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
})

describe('CookieConsent', () => {
  it('shows the banner when no choice is stored and hides it after accepting', async () => {
    const user = userEvent.setup()
    renderBanner()
    expect(screen.getByRole('dialog', { name: 'Cookies on this site' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Accept all' }))
    expect(screen.queryByRole('dialog', { name: 'Cookies on this site' })).not.toBeInTheDocument()
    expect(readCookieConsent()?.choice).toBe('all')
  })

  it('stores the essential-only and reject choices', async () => {
    const user = userEvent.setup()
    renderBanner()
    await user.click(screen.getByRole('button', { name: 'Essential only' }))
    expect(readCookieConsent()?.choice).toBe('essential')

    window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT))
    expect(await screen.findByRole('dialog', { name: 'Cookies on this site' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reject' }))
    expect(readCookieConsent()?.choice).toBe('rejected')
    expect(screen.queryByRole('dialog', { name: 'Cookies on this site' })).not.toBeInTheDocument()
  })

  it('stays hidden when a choice is already stored', () => {
    localStorage.setItem('dc_cookie_consent', JSON.stringify({ choice: 'essential', version: '2026-10-v1', decidedAt: '2026-10-12T00:00:00.000Z' }))
    renderBanner()
    expect(screen.queryByRole('dialog', { name: 'Cookies on this site' })).not.toBeInTheDocument()
  })

  it('links to the privacy policy', () => {
    renderBanner()
    expect(screen.getByRole('link', { name: 'privacy policy' })).toHaveAttribute('href', '/privacy')
  })
})

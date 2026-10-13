export type CookieChoice = 'all' | 'essential' | 'rejected'

export interface StoredCookieConsent {
  choice: CookieChoice
  version: string
  decidedAt: string
}

export const COOKIE_CONSENT_VERSION = '2026-10-v1'

const STORAGE_KEY = 'dc_cookie_consent'

export const OPEN_COOKIE_SETTINGS_EVENT = 'dc:open-cookie-settings'

export function readCookieConsent(): StoredCookieConsent | null {
  if (typeof localStorage === 'undefined') {
    return null
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) {
      return null
    }
    const parsed = JSON.parse(raw) as Partial<StoredCookieConsent>
    if (parsed.choice !== 'all' && parsed.choice !== 'essential' && parsed.choice !== 'rejected') {
      return null
    }
    if (parsed.version !== COOKIE_CONSENT_VERSION) {
      return null
    }
    return { choice: parsed.choice, version: COOKIE_CONSENT_VERSION, decidedAt: typeof parsed.decidedAt === 'string' ? parsed.decidedAt : '' }
  } catch {
    return null
  }
}

export function storeCookieConsent(choice: CookieChoice): StoredCookieConsent {
  const stored: StoredCookieConsent = { choice, version: COOKIE_CONSENT_VERSION, decidedAt: new Date().toISOString() }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {
  }
  return stored
}

export function openCookieSettings(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT))
  }
}

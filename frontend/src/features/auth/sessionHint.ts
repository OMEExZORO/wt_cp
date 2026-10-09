const KEY = 'dc_session_hint'

export function hasSessionHint(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    return true
  }
}

export function setSessionHint(): void {
  try {
    window.localStorage.setItem(KEY, '1')
  } catch {
    return
  }
}

export function clearSessionHint(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    return
  }
}

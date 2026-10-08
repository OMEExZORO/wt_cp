export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null
  }
  const prefix = `${encodeURIComponent(name)}=`
  const match = document.cookie.split('; ').find((part) => part.startsWith(prefix))
  return match === undefined ? null : decodeURIComponent(match.slice(prefix.length))
}

export function setCookie(name: string, value: string, days = 365): void {
  if (typeof document === 'undefined') {
    return
  }
  const expires = new Date(Date.now() + days * 86400000).toUTCString()
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax${secure}`
}

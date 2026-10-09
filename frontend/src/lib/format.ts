export function formatDateTime(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return 'Never'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatDate(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function relativeAge(value: string | null | undefined, now: Date = new Date()): string {
  if (value === null || value === undefined || value === '') {
    return ''
  }
  const then = new Date(value)
  if (Number.isNaN(then.getTime())) {
    return ''
  }
  const days = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 86400000))
  if (days < 7) {
    return 'this week'
  }
  if (days < 30) {
    const weeks = Math.floor(days / 7)
    return weeks === 1 ? 'a week ago' : `${weeks} weeks ago`
  }
  if (days < 365) {
    const months = Math.max(1, Math.round(days / 30))
    if (months >= 12) {
      return 'a year ago'
    }
    return months === 1 ? 'a month ago' : `${months} months ago`
  }
  const years = Math.floor(days / 365)
  return years === 1 ? 'a year ago' : `${years} years ago`
}

import { TZID } from './ics-calendar.js'

export const BASE = 'https://calendar.google.com/calendar/render'
const MAX_DETAILS = 1500

export const rawUrlEncode = (value) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)

const utcStamp = (date) => date.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z'

export const buildGoogleLink = (title, start, end, details = '', location = '') => {
  if (end.getTime() <= start.getTime()) throw new Error('Event end must be after its start')
  const params = [
    ['action', 'TEMPLATE'],
    ['text', title],
    ['dates', `${utcStamp(start)}/${utcStamp(end)}`],
    ['details', [...details].slice(0, MAX_DETAILS).join('')],
    ['location', location],
    ['ctz', TZID],
  ]
  const pairs = []
  for (const [key, value] of params) {
    if (value === '' && key !== 'text') continue
    const encoded = key === 'dates' ? rawUrlEncode(value).replaceAll('%2F', '/') : rawUrlEncode(value)
    pairs.push(`${key}=${encoded}`)
  }
  return `${BASE}?${pairs.join('&')}`
}

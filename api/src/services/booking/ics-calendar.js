import { atomTimestamp } from '../../core/time.js'

export const TZID = 'Asia/Kolkata'
const PRODID = '-//Meghnad Diagnostic Centre//DiagnoCare Booking//EN'
const LINE_LIMIT = 75

const localStamp = (date) => atomTimestamp(date, TZID).slice(0, 19).replace(/[-:]/g, '')
const utcStamp = (date) => date.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z'

export const escapeText = (value) => {
  let text = String(value).replace(/\r\n|\r/g, '\n')
  text = text.replace(/[\x00-\x08\x0B-\x1F\x7F]/gu, '')
  return text.replace(/[\\;,\n]/g, (char) => (char === '\n' ? '\\n' : `\\${char}`))
}

export const fold = (line) => {
  if (Buffer.byteLength(line) <= LINE_LIMIT) return line
  const parts = []
  let current = ''
  let limit = LINE_LIMIT
  for (const char of line) {
    if (Buffer.byteLength(current) + Buffer.byteLength(char) > limit) {
      parts.push(current)
      current = ''
      limit = LINE_LIMIT - 1
    }
    current += char
  }
  parts.push(current)
  return parts.join('\r\n ')
}

export const icsFilename = (reference) => {
  const safe = String(reference).replace(/[^A-Za-z0-9-]/g, '')
  return `appointment-${safe === '' ? 'mdc' : safe.toLowerCase()}.ics`
}

const uri = (value) => String(value).replace(/[\x00-\x20\x7F]/g, '')

export const buildEvent = (event) => {
  for (const key of ['uid', 'start', 'end', 'summary']) {
    if (event[key] === undefined || event[key] === null) throw new Error(`Missing calendar field ${key}`)
  }
  if (event.end.getTime() <= event.start.getTime()) throw new Error('Event end must be after its start')
  const stamp = event.dtstamp ?? new Date()
  const cancelled = (event.status ?? 'CONFIRMED') === 'CANCELLED'
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    `METHOD:${cancelled ? 'CANCEL' : 'PUBLISH'}`,
    'BEGIN:VTIMEZONE',
    `TZID:${TZID}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0530',
    'TZOFFSETTO:+0530',
    'TZNAME:IST',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${escapeText(event.uid)}`,
    `SEQUENCE:${Math.max(0, Number.parseInt(event.sequence ?? 0, 10) || 0)}`,
    `DTSTAMP:${utcStamp(stamp)}`,
    `DTSTART;TZID=${TZID}:${localStamp(event.start)}`,
    `DTEND;TZID=${TZID}:${localStamp(event.end)}`,
    `SUMMARY:${escapeText(event.summary)}`,
  ]
  if ((event.description ?? '') !== '') lines.push(`DESCRIPTION:${escapeText(event.description)}`)
  if ((event.location ?? '') !== '') lines.push(`LOCATION:${escapeText(event.location)}`)
  if ((event.url ?? '') !== '') lines.push(`URL:${uri(event.url)}`)
  lines.push(`STATUS:${cancelled ? 'CANCELLED' : 'CONFIRMED'}`)
  lines.push('TRANSP:OPAQUE')
  if (!cancelled) {
    lines.push('BEGIN:VALARM')
    lines.push('ACTION:DISPLAY')
    lines.push(`DESCRIPTION:${escapeText(`Reminder: ${event.summary}`)}`)
    lines.push('TRIGGER:-PT2H')
    lines.push('END:VALARM')
  }
  lines.push('END:VEVENT')
  lines.push('END:VCALENDAR')
  return `${lines.map(fold).join('\r\n')}\r\n`
}

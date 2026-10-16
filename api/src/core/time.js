const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const formatters = new Map()

const zoneParts = (date, zone) => {
  let formatter = formatters.get(zone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'longOffset',
    })
    formatters.set(zone, formatter)
  }
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
  const offset = parts.timeZoneName === 'GMT' ? '+00:00' : parts.timeZoneName.replace('GMT', '')
  return { ...parts, offset }
}

export const zonedDate = (date, zone) => {
  const p = zoneParts(date, zone)
  return `${p.year}-${p.month}-${p.day}`
}

export const sqlTimestamp = (date, zone) => {
  const p = zoneParts(date, zone)
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}${p.offset}`
}

export const atomTimestamp = (date, zone) => {
  const p = zoneParts(date, zone)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${p.offset}`
}

export const humanTimestamp = (date, zone) => {
  const p = zoneParts(date, zone)
  const hour = Number(p.hour)
  const twelve = String(hour % 12 === 0 ? 12 : hour % 12).padStart(2, '0')
  return `${p.day} ${MONTHS[Number(p.month) - 1]} ${p.year}, ${twelve}:${p.minute} ${hour < 12 ? 'AM' : 'PM'}`
}

export const parseTimestamp = (value) => {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  let text = String(value).trim().replace(' ', 'T')
  text = text.replace(/(\.\d{3})\d+/, '$1')
  text = text.replace(/([+-]\d{2})$/, '$1:00')
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

export const toIso = (value, zone) => {
  const date = parseTimestamp(value)
  return date === null ? null : atomTimestamp(date, zone)
}

export const epochSeconds = (value) => {
  const date = parseTimestamp(value)
  return date === null ? null : Math.floor(date.getTime() / 1000)
}

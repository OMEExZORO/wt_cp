export const DEFAULT_CAPACITY = { USG: 2, CT: 1, BIOPSY: 1 }
export const DEFAULT_CLOSED_WEEKDAYS = [7]

const MODALITIES = ['USG', 'CT', 'BIOPSY']
const DAY_MS = 86400000

const parseDate = (text) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!match) return null
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return date.toISOString().slice(0, 10) === text ? date : null
}

const parseMinutes = (text) => {
  const match = /^(\d{2}):(\d{2})$/.exec(text)
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null
  return Number(match[1]) * 60 + Number(match[2])
}

const clock = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

const isoWeekday = (date) => date.getUTCDay() || 7

export class SlotGenerator {
  static DEFAULT_CAPACITY = DEFAULT_CAPACITY

  constructor(slots) {
    this.slots = slots
  }

  static plan(
    branchIds,
    capacities,
    fromDate,
    days,
    openTime = '08:00',
    closeTime = '22:00',
    intervalMinutes = 30,
    closedWeekdays = DEFAULT_CLOSED_WEEKDAYS,
  ) {
    if (days < 1 || days > 366) throw new RangeError('Days must be between 1 and 366')
    if (intervalMinutes < 5 || intervalMinutes > 240) throw new RangeError('Interval must be between 5 and 240 minutes')
    for (const [modality, capacity] of Object.entries(capacities)) {
      if (!MODALITIES.includes(modality) || Math.trunc(Number(capacity)) < 1 || Math.trunc(Number(capacity)) > 50) {
        throw new RangeError(`Invalid capacity for ${modality}`)
      }
    }
    const start = parseDate(fromDate)
    const open = parseMinutes(openTime)
    const close = parseMinutes(closeTime)
    if (start === null || open === null || close === null || close <= open) {
      throw new RangeError('Invalid date or opening hours')
    }

    const times = []
    for (let t = open; t + intervalMinutes <= close; t += intervalMinutes) {
      times.push([clock(t), clock(t + intervalMinutes)])
    }

    const rows = []
    for (let d = 0; d < days; d += 1) {
      const date = new Date(start.getTime() + d * DAY_MS)
      if (closedWeekdays.includes(isoWeekday(date))) continue
      const slotDate = date.toISOString().slice(0, 10)
      for (const branchId of branchIds) {
        for (const [modality, capacity] of Object.entries(capacities)) {
          for (const [from, to] of times) {
            rows.push({
              branch_id: String(branchId),
              modality,
              slot_date: slotDate,
              start_time: from,
              end_time: to,
              capacity: Math.trunc(Number(capacity)),
            })
          }
        }
      }
    }
    return rows
  }

  insert(rows) {
    return this.slots.insertIgnore(rows)
  }
}

import { appointmentIcs, appointmentLocation } from './appointment-presenter.js'
import { icsFilename } from './ics-calendar.js'
import { at } from './slot-capacity.js'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
]

export const formatWhen = (date, time) => {
  at(date, time)
  const [year, month, day] = String(date).split('-').map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  const hour = Number(String(time).slice(0, 2))
  const minute = String(time).slice(3, 5)
  const twelve = hour % 12 === 0 ? 12 : hour % 12
  return `${weekday} ${day} ${MONTHS[month - 1]} ${year}, ${twelve}:${minute} ${hour < 12 ? 'AM' : 'PM'}`
}

export class AppointmentNotifier {
  constructor({ mail, config, clock }) {
    this.mail = mail
    this.config = config
    this.clock = clock
  }

  confirmed(row) {
    return this.send(row, 'booking-confirmed')
  }

  rescheduled(row, previous) {
    let before = ''
    if (previous.date !== undefined && previous.date !== null && previous.start_time !== undefined && previous.start_time !== null) {
      before = formatWhen(previous.date, previous.start_time)
    }
    return this.send(row, 'booking-rescheduled', { previous_when: before })
  }

  cancelled(row) {
    return this.send(row, 'booking-cancelled')
  }

  domain() {
    try {
      const host = new URL(String(this.config.url)).hostname
      return host !== '' ? host : 'diagnocare.local'
    } catch {
      return 'diagnocare.local'
    }
  }

  portalUrl(row) {
    return `${String(this.config.frontendUrl).replace(/\/+$/, '')}/portal/patient/appointments/${row.id}`
  }

  async send(row, template, extra = {}) {
    const email = String(row.patient_email ?? '').trim()
    if (email === '') return false
    const vars = {
      name: String(row.patient_name),
      reference: String(row.reference_code),
      scan_name: String(row.scan_name),
      branch_name: String(row.branch_name),
      location: appointmentLocation(row),
      when: formatWhen(row.slot_date, row.start_time),
      preparation: String(row.preparation_tips ?? '').trim(),
      link: this.portalUrl(row),
      reason: String(row.cancellation_reason ?? '').trim(),
      ...extra,
    }
    const attachments = [
      {
        name: icsFilename(String(row.reference_code)),
        type: `text/calendar; charset=utf-8; method=${row.status === 'cancelled' ? 'CANCEL' : 'PUBLISH'}`,
        content: appointmentIcs(row, this.clock.now(), this.domain(), this.portalUrl(row)),
      },
    ]
    return this.mail.sendTemplate(email, String(row.patient_name), template, vars, attachments)
  }
}

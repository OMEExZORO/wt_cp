import { atomTimestamp } from '../core/time.js'

export class Clock {
  constructor({ timezone = 'Asia/Kolkata', fixed = null } = {}) {
    this.timezone = timezone
    this.fixed = fixed === null ? null : new Date(fixed)
  }

  now() {
    return this.fixed === null ? new Date() : new Date(this.fixed.getTime())
  }

  atom(date = this.now()) {
    return atomTimestamp(date, this.timezone)
  }

  today() {
    return this.atom().slice(0, 10)
  }

  time() {
    return this.atom().slice(11, 19)
  }

  addDays(days) {
    const [year, month, day] = this.today().split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
  }
}

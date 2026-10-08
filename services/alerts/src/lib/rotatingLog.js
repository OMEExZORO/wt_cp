import fs from 'node:fs'
import path from 'node:path'

const pad = (n) => String(n).padStart(2, '0')

export const dayStamp = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export class RotatingLog {
  constructor({ dir, baseName = 'audit', maxBytes = 1024 * 1024, keep = 7, clock = () => new Date() }) {
    this.dir = dir
    this.baseName = baseName
    this.maxBytes = maxBytes
    this.keep = keep
    this.clock = clock
    fs.mkdirSync(dir, { recursive: true })
    this.activePath = path.join(dir, `${baseName}.log`)
    this.activeDay = this.#initialDay()
  }

  #initialDay() {
    try {
      return dayStamp(fs.statSync(this.activePath).mtime)
    } catch {
      return dayStamp(this.clock())
    }
  }

  #size() {
    try {
      return fs.statSync(this.activePath).size
    } catch {
      return 0
    }
  }

  archives() {
    const pattern = new RegExp(`^${this.baseName}-(\\d{4}-\\d{2}-\\d{2})\\.(\\d+)\\.log$`)
    return fs
      .readdirSync(this.dir)
      .map((name) => ({ name, match: pattern.exec(name) }))
      .filter((entry) => entry.match)
      .map((entry) => ({ name: entry.name, day: entry.match[1], seq: Number(entry.match[2]) }))
      .sort((a, b) => (a.day === b.day ? a.seq - b.seq : a.day < b.day ? -1 : 1))
  }

  #rotate() {
    if (this.#size() === 0) return
    const sameDay = this.archives().filter((entry) => entry.day === this.activeDay)
    const seq = sameDay.length ? Math.max(...sameDay.map((entry) => entry.seq)) + 1 : 1
    fs.renameSync(this.activePath, path.join(this.dir, `${this.baseName}-${this.activeDay}.${seq}.log`))
    const all = this.archives()
    for (const stale of all.slice(0, Math.max(0, all.length - this.keep))) {
      fs.rmSync(path.join(this.dir, stale.name), { force: true })
    }
  }

  write(level, event, fields = {}) {
    const now = this.clock()
    const line = `${JSON.stringify({ ts: now.toISOString(), level, event, ...fields })}\n`
    const today = dayStamp(now)
    const bytes = Buffer.byteLength(line)
    const size = this.#size()
    if (today !== this.activeDay || (size > 0 && size + bytes > this.maxBytes)) {
      this.#rotate()
    }
    this.activeDay = today
    fs.appendFileSync(this.activePath, line)
    return line
  }

  info(event, fields) {
    return this.write('info', event, fields)
  }

  warn(event, fields) {
    return this.write('warn', event, fields)
  }

  error(event, fields) {
    return this.write('error', event, fields)
  }

  tail(count = 100) {
    let text = ''
    try {
      text = fs.readFileSync(this.activePath, 'utf8')
    } catch {
      return []
    }
    return text.split('\n').filter(Boolean).slice(-Math.max(1, count))
  }
}

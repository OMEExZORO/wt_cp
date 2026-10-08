import fs from 'node:fs'
import path from 'node:path'
import nodemailer from 'nodemailer'

export class EmailChannel {
  constructor({ driver, from, fromName, smtp, logDir, transport }) {
    this.name = 'email'
    this.driver = driver
    this.from = fromName ? `"${fromName}" <${from}>` : from
    this.logFile = path.join(logDir, 'mail.log')
    this.transport = transport ?? null
    if (driver === 'smtp' && !this.transport) {
      this.transport = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
      })
    }
    fs.mkdirSync(logDir, { recursive: true })
  }

  async send({ to, subject, text }) {
    if (!to) return { ok: false, reason: 'no_recipient' }
    if (this.driver === 'smtp') {
      await this.transport.sendMail({ from: this.from, to, subject, text })
      return { ok: true, driver: 'smtp' }
    }
    const entry = `${JSON.stringify({ ts: new Date().toISOString(), from: this.from, to, subject, text })}\n`
    await fs.promises.appendFile(this.logFile, entry)
    return { ok: true, driver: 'log' }
  }
}

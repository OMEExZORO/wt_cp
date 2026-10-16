import { appendFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import nodemailer from 'nodemailer'

const attachmentNames = (attachments) => {
  if (attachments.length === 0) return ''
  const names = attachments.map(
    (a) => `${a.name ?? 'file'} (${a.type ?? 'application/octet-stream'}, ${Buffer.byteLength(a.content ?? '')} bytes)`,
  )
  return ` [${names.join(', ')}]`
}

export class LogMailer {
  constructor({ filePath, from }) {
    this.filePath = filePath
    this.from = from
  }

  async send(message) {
    const entry = [
      '='.repeat(72),
      `Date: ${new Date().toISOString()}`,
      `From: ${this.from}`,
      `To: ${message.toName} <${message.to}>`,
      `Subject: ${message.subject}`,
      `Attachments: ${message.attachments.length}${attachmentNames(message.attachments)}`,
      '',
      message.text,
      '',
    ].join('\n')
    await mkdir(path.dirname(this.filePath), { recursive: true })
    await appendFile(this.filePath, `${entry}\n`)
  }
}

export class SmtpMailer {
  constructor(mail) {
    this.mail = mail
    const encryption = mail.smtpEncryption.toLowerCase()
    this.transport = nodemailer.createTransport({
      host: mail.smtpHost,
      port: mail.smtpPort,
      secure: encryption === 'ssl' || encryption === 'smtps',
      requireTLS: !['ssl', 'smtps', 'none', ''].includes(encryption),
      auth: mail.smtpUser ? { user: mail.smtpUser, pass: mail.smtpPass } : undefined,
    })
  }

  async send(message) {
    await this.transport.sendMail({
      from: { name: this.mail.fromName, address: this.mail.from },
      to: { name: message.toName, address: message.to },
      subject: message.subject,
      html: message.html,
      text: message.text,
      attachments: message.attachments.map((a) => ({ filename: a.name, content: a.content, contentType: a.type })),
    })
  }
}

export const createMailer = (config) =>
  config.mail.driver === 'smtp'
    ? new SmtpMailer(config.mail)
    : new LogMailer({ filePath: config.mail.logPath, from: config.mail.from })

export class InMemoryMailer {
  constructor() {
    this.sent = []
  }

  async send(message) {
    this.sent.push(message)
  }
}

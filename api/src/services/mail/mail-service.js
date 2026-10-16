import { layout, templates } from './templates/index.js'

export class MailService {
  constructor({ mailer, logger, globals = {} }) {
    this.mailer = mailer
    this.logger = logger
    this.globals = globals
  }

  async sendTemplate(to, toName, template, vars = {}, attachments = []) {
    try {
      const { subject, html, text } = this.render(template, vars)
      await this.mailer.send({ to, toName, subject, html, text, attachments })
      return true
    } catch (error) {
      this.logger.error('Email could not be sent', { template, error: error.message })
      return false
    }
  }

  render(template, vars = {}) {
    if (!/^[a-z0-9-]+$/.test(template) || !templates[template]) throw new Error(`Email template ${template} not found`)
    const data = { ...this.globals, ...vars }
    const safe = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, typeof value === 'string' || typeof value === 'number' ? value : '']),
    )
    const { subject, html, text } = templates[template](safe)
    return { subject, html: layout({ ...safe, title: subject, content: html }), text }
  }
}

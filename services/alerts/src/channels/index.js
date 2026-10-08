import { config } from '../config.js'
import { audit } from '../lib/audit.js'
import { EmailChannel } from './emailChannel.js'
import { SmsChannel } from './smsChannel.js'

export const email = new EmailChannel({
  driver: config.mail.driver,
  from: config.mail.from,
  fromName: config.mail.fromName,
  smtp: config.mail.smtp,
  logDir: config.logs.dir,
})

export const sms = new SmsChannel({ log: audit })

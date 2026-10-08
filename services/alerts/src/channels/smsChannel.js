export class SmsChannel {
  constructor({ log }) {
    this.name = 'sms_stub'
    this.log = log
  }

  async send({ to, text }) {
    this.log.info('sms.stub', { to_present: Boolean(to), length: text ? text.length : 0, note: 'SMS stub, not implemented' })
    return { ok: true, driver: 'stub' }
  }
}

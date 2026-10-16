import { Validator } from './validator.js'

export class RequestValidator {
  constructor({ audit, timezone }) {
    this.audit = audit
    this.timezone = timezone
  }

  async validate(req, rules, messages = {}, input = null) {
    const source = input ?? (req.isMethodSafe() ? req.query() : req.body())
    const validator = new Validator({ timezone: this.timezone })
    try {
      return validator.validate(source, rules, messages)
    } catch (error) {
      for (const threat of error.threats ?? []) {
        await this.audit.log(`security.${threat.type}_attempt`, req, {
          metadata: { field: threat.field, sample: threat.sample },
        })
      }
      throw error
    }
  }
}

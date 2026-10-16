export class DatabaseAuditLogger {
  constructor({ db, logger }) {
    this.db = db
    this.logger = logger
  }

  async log(action, req = null, options = {}) {
    const actor = options.actor ?? req?.user ?? null
    const metadata = { ...(options.metadata ?? {}), ...(req ? { path: req.path, method: req.method } : {}) }
    try {
      await this.db.query(
        `INSERT INTO audit_log (actor_user_id, actor_role, action, entity_type, entity_id, ip_address, user_agent, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
        [
          actor?.id ?? null,
          actor?.role ?? null,
          action,
          options.entity_type ?? null,
          options.entity_id === undefined || options.entity_id === null ? null : String(options.entity_id),
          req?.ip ?? null,
          req?.userAgent ?? null,
          JSON.stringify(metadata),
        ],
      )
    } catch (error) {
      this.logger.error('Audit log write failed', { action, error: error.message })
    }
  }
}

export class InMemoryAuditLogger {
  constructor() {
    this.entries = []
  }

  async log(action, req = null, options = {}) {
    this.entries.push({ action, req, options })
  }

  actions() {
    return this.entries.map((entry) => entry.action)
  }
}

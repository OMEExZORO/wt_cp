import { Model } from './model.js'
import { ScanType } from './scan-type.js'

const escapeLike = (value) => ScanType.escapeLike(value)

const has = (filters, key) => filters[key] !== undefined && filters[key] !== null

export class AuditLogRepository extends Model {
  static table = 'audit_log'

  search(filters, limit, offset) {
    const [where, params] = this.where(filters)
    return this.db.all(
      `SELECT a.id, a.actor_user_id, a.actor_role, u.full_name AS actor_name, a.action, a.entity_type, a.entity_id,
              host(a.ip_address) AS ip_address, a.metadata, a.created_at
       FROM audit_log a LEFT JOIN users u ON u.id = a.actor_user_id${where}
       ORDER BY a.created_at DESC, a.id DESC LIMIT ${limit} OFFSET ${offset}`,
      params,
    )
  }

  async count(filters) {
    const [where, params] = this.where(filters)
    return Number(await this.db.value(`SELECT count(*) FROM audit_log a${where}`, params))
  }

  where(filters) {
    const clauses = []
    const params = []
    if (has(filters, 'action')) {
      params.push(filters.action, `${escapeLike(String(filters.action))}.%`)
      clauses.push(`(a.action = $${params.length - 1} OR a.action LIKE $${params.length})`)
    }
    for (const key of ['actor_user_id', 'actor_role', 'entity_type']) {
      if (has(filters, key)) {
        params.push(filters[key])
        clauses.push(`a.${key} = $${params.length}`)
      }
    }
    if (has(filters, 'from')) {
      params.push(filters.from)
      clauses.push(`a.created_at >= CAST($${params.length} AS date)::timestamp AT TIME ZONE 'Asia/Kolkata'`)
    }
    if (has(filters, 'to')) {
      params.push(filters.to)
      clauses.push(`a.created_at < (CAST($${params.length} AS date) + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'`)
    }
    return [clauses.length === 0 ? '' : ` WHERE ${clauses.join(' AND ')}`, params]
  }
}

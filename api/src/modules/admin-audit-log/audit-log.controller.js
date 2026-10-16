import { ValidationError } from '../../core/errors.js'
import { toIso } from '../../core/time.js'
import { pagination, paged, phpJson, withoutNulls } from '../../services/admin/admin-support.js'

const decodeMetadata = (value) => {
  let decoded = value
  if (typeof value === 'string') {
    try {
      decoded = JSON.parse(value)
    } catch {
      return []
    }
  }
  return decoded !== null && typeof decoded === 'object' ? phpJson(decoded) : []
}

export const index = async (req, app) => {
  const [page, perPage, offset] = await pagination(req, app)
  const validated = await app.validate(req, {
    action: ['nullable', 'max:80', 'regex:/^[a-z_]+(\\.[a-z_]+)*$/'],
    actor_user_id: 'nullable|uuid',
    actor_role: 'nullable|in:patient,receptionist,doctor,admin,referrer',
    entity_type: ['nullable', 'max:60', 'regex:/^[a-z_]+$/'],
    from: 'nullable|date',
    to: 'nullable|date',
  })
  const filters = withoutNulls(validated)
  if (filters.from !== undefined && filters.to !== undefined && filters.to < filters.from) {
    throw ValidationError.withField('to', 'The end date must not be before the start date.')
  }
  const log = app.models.auditLogRepository
  const entries = (await log.search(filters, perPage, offset)).map((row) => ({
    id: Number(row.id),
    actor_user_id: row.actor_user_id,
    actor_name: row.actor_name,
    actor_role: row.actor_role,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    ip_address: row.ip_address,
    metadata: decodeMetadata(row.metadata),
    created_at: toIso(row.created_at, app.config.timezone),
  }))
  return paged('entries', entries, await log.count(filters), page, perPage)
}

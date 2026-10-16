import { ConflictError, NotFoundError, ValidationError } from '../../core/errors.js'
import { noContent, ok } from '../../core/response.js'
import { AdminRepository } from '../../models/admin-repository.js'
import { AuditLogRepository } from '../../models/audit-log-repository.js'
import { Branch } from '../../models/branch.js'
import { ChecklistItem } from '../../models/checklist-item.js'
import { Faq } from '../../models/faq.js'
import { Review } from '../../models/review.js'
import { ScanCategory } from '../../models/scan-category.js'
import { ScanType } from '../../models/scan-type.js'
import { Slot } from '../../models/slot.js'
import { StatsRepository } from '../../models/stats-repository.js'

export const SLUG_PATTERN = '/^[a-z0-9]+(-[a-z0-9]+)*$/'
export const HTTPS_URL_PATTERN = '/^https:\\/\\/[A-Za-z0-9][A-Za-z0-9.\\-]*\\.[A-Za-z]{2,}(?::\\d{1,5})?(?:[\\/?#][^\\s<>"\'\\\\]*)?$/'

export const flag = (value) => value === true || value === 1 || value === 't' || value === 'true' || value === '1'

export const registerAdminModels = (app) => {
  const { db } = app
  const options = { timezone: app.config.timezone }
  app.models.adminRepository ??= new AdminRepository(db, options)
  app.models.auditLogRepository ??= new AuditLogRepository(db, options)
  app.models.statsRepository ??= new StatsRepository(db, options)
  app.models.branches ??= new Branch(db, options)
  app.models.faqs ??= new Faq(db, options)
  app.models.reviews ??= new Review(db, options)
  app.models.scanCategories ??= new ScanCategory(db, options)
  app.models.scanTypes ??= new ScanType(db, options)
  app.models.checklistItems ??= new ChecklistItem(db, options)
  app.models.slots ??= new Slot(db, options)
}

export const phpJson = (value) => {
  if (Array.isArray(value)) return value.map(phpJson)
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
    return entries.length === 0 ? [] : Object.fromEntries(entries.map(([key, item]) => [key, phpJson(item)]))
  }
  return value
}

export const partial = (req, rules) => {
  if (req.method !== 'PATCH') return rules
  return Object.fromEntries(
    Object.entries(rules).map(([field, fieldRules]) => [
      field,
      Array.isArray(fieldRules) ? ['sometimes', ...fieldRules] : `sometimes|${fieldRules}`,
    ]),
  )
}

export const pagination = async (req, app) => {
  const page = await app.validate(req, { page: 'nullable|integer|min:1|max:100000', per_page: 'nullable|integer|min:1|max:100' })
  const perPage = Number(page.per_page ?? 20)
  const number = Number(page.page ?? 1)
  return [number, perPage, (number - 1) * perPage]
}

export const paged = (key, items, total, page, perPage) => {
  const meta = { page, per_page: perPage, total }
  return ok({ [key]: items, pagination: meta }, 200, meta)
}

export const withoutNulls = (filters) => Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== null))

export const record = (app, req, action, entityType, entityId, metadata = []) =>
  app.audit.log(action, req, { entity_type: entityType, entity_id: entityId, metadata })

const textOf = (value) => {
  if (typeof value === 'boolean') return value ? 't' : 'f'
  return value === null || value === undefined ? '' : String(value)
}

export const changedFields = (before, after) =>
  Object.entries(after)
    .filter(([field, value]) => Object.hasOwn(before, field) && textOf(before[field]) !== textOf(value))
    .map(([field]) => field)

export const requireFound = (row, label) => {
  if (row === null || row === undefined) throw new NotFoundError(`${label} not found.`)
  return row
}

export const runWrite = async (write, conflictMessage) => {
  try {
    return await write()
  } catch (error) {
    if (error?.code === '23505') throw new ConflictError(conflictMessage)
    if (error?.code === '23503') throw new ConflictError('This record is still in use. Deactivate it instead of deleting it.')
    if (error?.code === '23514') throw new ValidationError({ _: 'One of the values is outside the allowed range.' })
    throw error
  }
}

export const createRecord = async (app, req, model, data, entity, conflict) => {
  const row = await runWrite(() => model.create(data), conflict)
  await record(app, req, `admin.${entity}_created`, entity, String(row.id))
  return row
}

export const updateRecord = async (app, req, model, id, data, entity, label, conflict) => {
  const before = requireFound(await model.find(id), label)
  const updated = await runWrite(() => model.update(id, data), conflict)
  const row = requireFound(updated, label)
  await record(app, req, `admin.${entity}_updated`, entity, id, { fields: changedFields(before, data) })
  return row
}

export const deleteRecord = async (app, req, model, id, entity, label) => {
  const before = requireFound(await model.find(id), label)
  await runWrite(() => model.delete(id), 'Conflict')
  await record(app, req, `admin.${entity}_deleted`, entity, id, {
    label: String(before.name ?? before.question ?? before.code ?? id),
  })
  return noContent()
}

export const uuidParam = (req, name = 'id') => String(req.param(name) ?? '').toLowerCase()

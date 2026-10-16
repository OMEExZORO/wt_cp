import { ValidationError } from '../../core/errors.js'
import { requireUser } from '../../core/http.js'
import { toIso } from '../../core/time.js'
import { ok } from '../../core/response.js'
import { flag, record } from '../../services/admin/admin-support.js'
import { NON_CLEARABLE, buildRules, isEditable } from '../../services/admin/settings-validator.js'

export const MAX_KEYS = 40

const INTEGER_KEY = /^(?:0|-?[1-9]\d*)$/

const shorten = (value) => (value === null ? null : [...value].slice(0, 200).join(''))

const isList = (keys) => keys.every((key, index) => key === String(index))

const presentAll = async (app) => {
  const rows = (await app.models.adminRepository.settings()).map((row) => ({
    key: row.key,
    value: row.value,
    type: row.value_type,
    group: row.group_name,
    label: row.label,
    is_public: flag(row.is_public),
    is_placeholder: flag(row.is_placeholder),
    is_editable: isEditable(row),
    is_required: NON_CLEARABLE.includes(String(row.key)),
    updated_at: toIso(row.updated_at, app.config.timezone),
  }))
  return ok({ settings: rows })
}

export const index = (_req, app) => presentAll(app)

export const update = async (req, app) => {
  const submitted = req.body().settings ?? null
  const keys = submitted !== null && typeof submitted === 'object' && !Array.isArray(submitted) ? Object.keys(submitted) : []
  if (keys.length === 0 || isList(keys) || keys.length > MAX_KEYS) {
    throw new ValidationError({ settings: 'Send an object of setting keys and values.' })
  }
  for (const key of keys) {
    const value = submitted[key]
    const scalar = value === null || ['string', 'number', 'boolean'].includes(typeof value)
    if (INTEGER_KEY.test(key) || !scalar) throw new ValidationError({ settings: 'Every setting must be a single value.' })
  }

  const actor = requireUser(req)
  const changes = await app.db.tx(async (tx) => {
    const repository = app.models.adminRepository.using(tx)
    const rows = await repository.settingsByKeys(keys)
    const errors = {}
    for (const key of keys) {
      if (!Object.hasOwn(rows, key)) errors[key] = 'Unknown setting.'
      else if (!isEditable(rows[key])) errors[key] = 'This setting cannot be edited here.'
    }
    if (Object.keys(errors).length > 0) throw new ValidationError(errors)

    const clean = await app.validate(req, buildRules(rows), {}, submitted)
    const result = {}
    for (const [key, value] of Object.entries(clean)) {
      const row = rows[key]
      const text = value === null ? null : String(value)
      await repository.writeSetting(key, text, text === null, String(actor.id))
      if (String(row.value ?? '') !== String(text ?? '') || flag(row.is_placeholder) !== (text === null)) {
        result[key] = { from: shorten(row.value), to: shorten(text) }
      }
    }
    return result
  })

  await record(app, req, 'admin.settings_updated', 'site_settings', 'bulk', { changes: Object.keys(changes).length === 0 ? [] : changes })
  return presentAll(app)
}

import { ValidationError } from '../../core/errors.js'
import { created, ok } from '../../core/response.js'
import {
  HTTPS_URL_PATTERN, SLUG_PATTERN, createRecord, deleteRecord, flag, partial, requireFound, updateRecord, uuidParam,
} from '../../services/admin/admin-support.js'

const CONFLICT = 'A branch with this slug already exists.'

const rules = () => ({
  slug: ['required', 'max:60', `regex:${SLUG_PATTERN}`],
  name: 'required|min:2|max:120',
  address_line: 'required|min:3|max:255',
  landmark: 'nullable|max:160',
  area: 'nullable|max:120',
  city: 'required|min:2|max:80',
  state: 'required|min:2|max:80',
  postal_code: ['nullable', 'regex:/^[1-9]\\d{5}$/'],
  phone: 'nullable|phone',
  phone_secondary: 'nullable|phone',
  whatsapp: 'nullable|phone',
  email: 'nullable|email',
  opening_hours: 'nullable|text|max:500',
  maps_url: ['nullable', 'max:500', `regex:${HTTPS_URL_PATTERN}`],
  maps_embed_url: ['nullable', 'max:800', `regex:${HTTPS_URL_PATTERN}`],
  latitude: ['nullable', 'regex:/^-?\\d{1,2}(\\.\\d{1,6})?$/'],
  longitude: ['nullable', 'regex:/^-?\\d{1,3}(\\.\\d{1,6})?$/'],
  is_active: 'boolean',
  sort_order: 'integer|min:0|max:1000',
})

const prepare = (data, existing = null) => {
  if (data.latitude !== undefined && data.latitude !== null && Math.abs(Number(data.latitude)) > 90) {
    throw ValidationError.withField('latitude', 'Latitude must be between -90 and 90.')
  }
  if (data.longitude !== undefined && data.longitude !== null && Math.abs(Number(data.longitude)) > 180) {
    throw ValidationError.withField('longitude', 'Longitude must be between -180 and 180.')
  }
  const address = String(data.address_line ?? existing?.address_line ?? '')
  return { ...data, is_placeholder: address.startsWith('TODO') }
}

const present = (row) => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  address_line: row.address_line,
  landmark: row.landmark,
  area: row.area,
  city: row.city,
  state: row.state,
  postal_code: row.postal_code,
  phone: row.phone,
  phone_secondary: row.phone_secondary ?? null,
  whatsapp: row.whatsapp,
  email: row.email,
  opening_hours: row.opening_hours,
  maps_url: row.maps_url,
  maps_embed_url: row.maps_embed_url,
  latitude: row.latitude === null ? null : Number(row.latitude),
  longitude: row.longitude === null ? null : Number(row.longitude),
  is_placeholder: flag(row.is_placeholder),
  is_active: flag(row.is_active),
  sort_order: Number(row.sort_order),
})

export const index = async (_req, app) => ok({ branches: (await app.models.adminRepository.branches()).map(present) })

export const store = async (req, app) => {
  const data = prepare(await app.validate(req, rules()))
  const row = await createRecord(app, req, app.models.branches, data, 'branch', CONFLICT)
  return created(present(row))
}

export const update = async (req, app) => {
  const id = uuidParam(req)
  const validated = await app.validate(req, partial(req, rules()))
  const existing = requireFound(await app.models.branches.find(id), 'Branch')
  const row = await updateRecord(app, req, app.models.branches, id, prepare(validated, existing), 'branch', 'Branch', CONFLICT)
  return ok(present(row))
}

export const destroy = (req, app) => deleteRecord(app, req, app.models.branches, uuidParam(req), 'branch', 'Branch')

import { ok } from '../../core/response.js'

export const lookup = async (req, app) => {
  const data = await app.validate(req, { q: 'required|string|min:3|max:60' })
  const rows = await app.models.patients.search(data.q, 10)
  await app.audit.log('patient.lookup', req, { entity_type: 'patient', metadata: { results: rows.length } })
  return ok({ patients: rows.map((row) => ({ id: row.id, full_name: row.full_name, phone: row.phone })) })
}

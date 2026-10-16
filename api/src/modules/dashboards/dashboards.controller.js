import { requireUser } from '../../core/http.js'
import { ok } from '../../core/response.js'

const AREAS = {
  patient: 'Patient dashboard',
  doctor: 'Doctor dashboard',
  receptionist: 'Reception dashboard',
  admin: 'Admin dashboard',
  referrer: 'Referrer dashboard',
}

export const show = async (req) => {
  const user = requireUser(req)
  const area = req.path.split('/').pop()
  return ok({
    area,
    title: Object.hasOwn(AREAS, area) ? AREAS[area] : 'Dashboard',
    role: user.role,
    widgets: [],
  })
}

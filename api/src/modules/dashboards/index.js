import { get, group } from '../../core/router.js'
import { show } from './dashboards.controller.js'

export const routes = group('/dashboards', ['auth'], [
  get('/patient', show, ['role:patient']),
  get('/doctor', show, ['role:doctor,admin']),
  get('/receptionist', show, ['role:receptionist,admin']),
  get('/admin', show, ['role:admin']),
  get('/referrer', show, ['role:referrer']),
])

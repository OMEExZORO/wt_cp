import { del, get, group, patch, post } from '../../core/router.js'
import { registerAdminModels } from '../../services/admin/admin-support.js'
import * as controller from './slots.controller.js'

export const routes = group('/admin', ['auth', 'role:admin'], [
  get('/slots', controller.index),
  post('/slots/generate', controller.generate, ['throttle:admin-slot-generate,20,60']),
  patch('/slots/{id:uuid}', controller.update),
  del('/slots/{id:uuid}', controller.destroy),
])

export const register = registerAdminModels

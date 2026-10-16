import { get, group, patch } from '../../core/router.js'
import { registerAdminModels } from '../../services/admin/admin-support.js'
import * as controller from './settings.controller.js'

export const routes = group('/admin', ['auth', 'role:admin'], [
  get('/settings', controller.index),
  patch('/settings', controller.update),
])

export const register = registerAdminModels

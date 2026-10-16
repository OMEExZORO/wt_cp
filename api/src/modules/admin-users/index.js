import { get, group, patch, post } from '../../core/router.js'
import { registerAdminModels } from '../../services/admin/admin-support.js'
import * as controller from './users.controller.js'

export const routes = group('/admin', ['auth', 'role:admin'], [
  get('/users', controller.index),
  post('/users', controller.store),
  patch('/users/{id:uuid}', controller.update),
  post('/users/{id:uuid}/password-reset', controller.passwordReset, ['throttle:admin-password-reset,20,60']),
])

export const register = registerAdminModels

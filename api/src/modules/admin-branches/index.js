import { del, get, group, patch, post, put } from '../../core/router.js'
import { registerAdminModels } from '../../services/admin/admin-support.js'
import * as controller from './branches.controller.js'

export const routes = group('/admin', ['auth', 'role:admin'], [
  get('/branches', controller.index),
  post('/branches', controller.store),
  put('/branches/{id:uuid}', controller.update),
  patch('/branches/{id:uuid}', controller.update),
  del('/branches/{id:uuid}', controller.destroy),
])

export const register = registerAdminModels

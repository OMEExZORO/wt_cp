import { get, group, patch, post, put } from '../../core/router.js'
import { registerAdminModels } from '../../services/admin/admin-support.js'
import * as controller from './reviews.controller.js'

export const routes = group('/admin', ['auth', 'role:admin'], [
  get('/reviews', controller.index),
  post('/reviews', controller.store),
  put('/reviews/{id:uuid}', controller.update),
  patch('/reviews/{id:uuid}', controller.moderate),
])

export const register = registerAdminModels

import { del, get, group, patch, post, put } from '../../core/router.js'
import { registerAdminModels } from '../../services/admin/admin-support.js'
import * as controller from './faqs.controller.js'

export const routes = group('/admin', ['auth', 'role:admin'], [
  get('/faqs', controller.index),
  post('/faqs', controller.store),
  put('/faqs/{id:uuid}', controller.update),
  patch('/faqs/{id:uuid}', controller.update),
  del('/faqs/{id:uuid}', controller.destroy),
])

export const register = registerAdminModels

import { del, get, group, patch, post, put } from '../../core/router.js'
import { registerAdminModels } from '../../services/admin/admin-support.js'
import * as controller from './catalog.controller.js'

export const routes = group('/admin', ['auth', 'role:admin'], [
  get('/scan-categories', controller.categoryIndex),
  post('/scan-categories', controller.categoryStore),
  put('/scan-categories/{id:uuid}', controller.categoryUpdate),
  patch('/scan-categories/{id:uuid}', controller.categoryUpdate),
  del('/scan-categories/{id:uuid}', controller.categoryDestroy),

  get('/scan-types', controller.typeIndex),
  post('/scan-types', controller.typeStore),
  put('/scan-types/{id:uuid}', controller.typeUpdate),
  patch('/scan-types/{id:uuid}', controller.typeUpdate),
  del('/scan-types/{id:uuid}', controller.typeDestroy),

  get('/checklist-items', controller.checklistIndex),
  post('/checklist-items', controller.checklistStore),
  put('/checklist-items/{id:uuid}', controller.checklistUpdate),
  patch('/checklist-items/{id:uuid}', controller.checklistUpdate),
  del('/checklist-items/{id:uuid}', controller.checklistDestroy),
])

export const register = registerAdminModels

import { get, group } from '../../core/router.js'
import { registerAdminModels } from '../../services/admin/admin-support.js'
import * as controller from './audit-log.controller.js'

export const routes = group('/admin', ['auth', 'role:admin'], [get('/audit-log', controller.index)])

export const register = registerAdminModels

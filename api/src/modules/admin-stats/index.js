import { get, group } from '../../core/router.js'
import { registerAdminModels } from '../../services/admin/admin-support.js'
import * as controller from './stats.controller.js'

export const routes = group('/admin', ['auth', 'role:admin'], [get('/stats', controller.show)])

export const register = registerAdminModels

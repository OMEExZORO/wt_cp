import { get, group, patch, post } from '../../core/router.js'
import { registerReportModels } from '../../services/reports/context.js'
import * as controller from './referrals.controller.js'

export const routes = group('/referrals', ['auth'], [
  get('', controller.index, ['role:referrer,receptionist,doctor,admin']),
  post('', controller.store, ['role:referrer', 'throttle:referral-create,30,60']),
  get('/{id:uuid}', controller.show, ['role:referrer,receptionist,doctor,admin']),
  patch('/{id:uuid}', controller.update, ['role:receptionist,doctor,admin']),
])

export const register = registerReportModels

import { del, get, group, patch, post } from '../../core/router.js'
import { registerReportModels } from '../../services/reports/context.js'
import * as controller from './reports.controller.js'

export const routes = group('/reports', ['auth'], [
  get('', controller.index, ['role:patient,referrer,receptionist,doctor,admin']),
  post('', controller.store, ['role:doctor,receptionist,admin', 'throttle:report-upload,30,60']),
  get('/{id:uuid}', controller.show, ['role:patient,referrer,receptionist,doctor,admin']),
  get('/{id:uuid}/download', controller.download, ['role:patient,referrer,receptionist,doctor,admin', 'throttle:report-download,120,60']),
  patch('/{id:uuid}', controller.update, ['role:doctor,receptionist,admin']),
  del('/{id:uuid}', controller.destroy, ['role:admin']),
])

export const register = registerReportModels

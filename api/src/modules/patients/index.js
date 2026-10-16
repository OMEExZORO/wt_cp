import { get } from '../../core/router.js'
import { lookup } from './patients.controller.js'

export const routes = [get('/patients/lookup', lookup, ['auth', 'role:receptionist,admin', 'throttle:patient-lookup,60,10'])]

import { get, group } from '../../core/router.js'
import { wireBooking } from '../../services/booking/wiring.js'
import * as controller from './booking.controller.js'

export const routes = [
  group('/booking', ['auth'], [
    get('/availability', controller.availability),
    get('/days', controller.days),
    get('/next-available', controller.nextAvailable),
  ]),
  get('/scan-types/{id:uuid}/checklist', controller.checklist, ['auth']),
]

export const register = wireBooking

import { get, group, patch, post } from '../../core/router.js'
import { wireBooking } from '../../services/booking/wiring.js'
import * as controller from './appointments.controller.js'

export const routes = group('/appointments', ['auth'], [
  get('', controller.index, ['role:patient,receptionist,doctor,admin']),
  post('', controller.store, ['role:patient,receptionist,admin', 'verified', 'throttle:booking,30,60']),
  get('/{id:uuid}', controller.show, ['role:patient,receptionist,doctor,admin']),
  get('/{id:uuid}/ics', controller.ics, ['role:patient,receptionist,doctor,admin']),
  patch('/{id:uuid}/reschedule', controller.reschedule, ['role:patient,receptionist,admin', 'verified', 'throttle:booking-change,30,60']),
  patch('/{id:uuid}/cancel', controller.cancel, ['role:patient,receptionist,admin', 'throttle:booking-change,30,60']),
  patch('/{id:uuid}/status', controller.updateStatus, ['role:receptionist,doctor,admin']),
])

export const register = wireBooking

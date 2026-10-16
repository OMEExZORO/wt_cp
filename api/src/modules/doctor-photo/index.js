import { del, get, group, post } from '../../core/router.js'
import * as controller from './doctor-photo.controller.js'

export const routes = [
  get('/public/doctor/photo', controller.show),
  group('/admin', ['auth', 'role:admin'], [
    post('/doctor/photo', controller.upload),
    del('/doctor/photo', controller.destroy),
  ]),
]

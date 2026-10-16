import { del, get, group, patch, post, put } from '../../core/router.js'
import * as auth from './auth.controller.js'
import * as emailVerification from './email-verification.controller.js'
import * as password from './password.controller.js'

export const routes = group('/auth', [], [
  get('/csrf', auth.csrf),
  post('/register', auth.register, ['throttle:register,10,60']),
  post('/login', auth.login, ['throttle:login,20,10']),
  post('/logout', auth.logout),
  get('/me', auth.me, ['auth']),
  patch('/me', auth.updateMe, ['auth']),
  del('/sessions', auth.logoutEverywhere, ['auth']),
  post('/password/forgot', password.forgot, ['throttle:forgot,5,15']),
  post('/password/reset', password.reset, ['throttle:reset,10,15']),
  put('/password', password.change, ['auth', 'throttle:password-change,10,15']),
  post('/email/verify', emailVerification.verify, ['throttle:verify,20,15']),
  post('/email/resend', emailVerification.resend, ['auth', 'throttle:verify-resend,3,15']),
])

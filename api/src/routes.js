import { group } from './core/router.js'
import * as adminAuditLog from './modules/admin-audit-log/index.js'
import * as adminBranches from './modules/admin-branches/index.js'
import * as adminCatalog from './modules/admin-catalog/index.js'
import * as adminFaqs from './modules/admin-faqs/index.js'
import * as adminReviews from './modules/admin-reviews/index.js'
import * as adminSettings from './modules/admin-settings/index.js'
import * as adminSlots from './modules/admin-slots/index.js'
import * as adminStats from './modules/admin-stats/index.js'
import * as adminUsers from './modules/admin-users/index.js'
import * as alerts from './modules/alerts/index.js'
import * as appointments from './modules/appointments/index.js'
import * as auth from './modules/auth/index.js'
import * as booking from './modules/booking/index.js'
import * as dashboards from './modules/dashboards/index.js'
import * as doctorPhoto from './modules/doctor-photo/index.js'
import * as health from './modules/health/index.js'
import * as patients from './modules/patients/index.js'
import * as publicContent from './modules/public/index.js'
import * as queue from './modules/queue/index.js'
import * as referrals from './modules/referrals/index.js'
import * as reports from './modules/reports/index.js'
import * as reviews from './modules/reviews/index.js'

export const modules = [
  health,
  publicContent,
  auth,
  booking,
  appointments,
  patients,
  alerts,
  queue,
  reports,
  referrals,
  dashboards,
  doctorPhoto,
  reviews,
  adminStats,
  adminAuditLog,
  adminUsers,
  adminBranches,
  adminCatalog,
  adminSlots,
  adminSettings,
  adminFaqs,
  adminReviews,
]

export const buildRoutes = (apiPrefix = '/api/v1') => group(apiPrefix, [], modules.map((module) => module.routes))

export const registerModules = (app) => {
  for (const module of modules) module.register?.(app)
}

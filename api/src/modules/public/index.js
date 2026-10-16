import { get, group } from '../../core/router.js'
import { Branch } from '../../models/branch.js'
import { Faq } from '../../models/faq.js'
import { Review } from '../../models/review.js'
import { ScanCategory } from '../../models/scan-category.js'
import { ScanType } from '../../models/scan-type.js'
import { SiteSetting } from '../../models/site-setting.js'
import * as controller from './public.controller.js'

export const routes = group('/public', [], [
  get('/site', controller.site),
  get('/doctor', controller.doctor),
  get('/branches', controller.branches),
  get('/scan-categories', controller.scanCategories),
  get('/scan-types', controller.scanTypes),
  get('/scan-types/{ref}', controller.scanType),
  get('/faqs', controller.faqs),
  get('/reviews', controller.reviews),
])

export const register = (app) => {
  const options = { timezone: app.config.timezone }
  app.models.siteSettings ??= new SiteSetting(app.db, options)
  app.models.branches ??= new Branch(app.db, options)
  app.models.scanCategories ??= new ScanCategory(app.db, options)
  app.models.scanTypes ??= new ScanType(app.db, options)
  app.models.faqs ??= new Faq(app.db, options)
  app.models.reviews ??= new Review(app.db, options)
}

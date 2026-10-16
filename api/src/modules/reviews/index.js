import { get, group, post } from '../../core/router.js'
import { Review } from '../../models/review.js'
import { ReviewRepository } from '../../models/review-repository.js'
import * as controller from './reviews.controller.js'

export const routes = group('/reviews', ['auth'], [
  get('/mine', controller.mine, ['role:patient']),
  post('', controller.store, ['role:patient', 'throttle:reviews,5,60']),
])

export const register = (app) => {
  const options = { timezone: app.config.timezone }
  app.models.reviewSubmissions ??= new Review(app.db, options)
  app.models.reviewRepository ??= new ReviewRepository(app.db, options)
}

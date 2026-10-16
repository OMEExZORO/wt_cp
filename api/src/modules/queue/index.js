import { get } from '../../core/router.js'
import { ReadingQueueQuery } from '../../models/reading-queue-query.js'
import { Clock } from '../../services/clock.js'
import { show } from './queue.controller.js'

export const routes = [get('/doctor/queue', show, ['auth', 'role:doctor,admin'])]

export const register = (app) => {
  app.models.readingQueue ??= new ReadingQueueQuery(app.db, { timezone: app.config.timezone })
  app.services.clock ??= new Clock({ timezone: app.config.timezone })
}

import express from 'express'
import { createContainer } from './container.js'
import { buildConfig } from './core/config.js'
import { PgDb } from './core/database.js'
import { ErrorHandler } from './core/error-handler.js'
import { PayloadTooLargeError, BadRequestError } from './core/errors.js'
import { Kernel } from './core/kernel.js'
import { Logger } from './core/logger.js'
import { ApiRequest } from './core/request.js'
import { Router } from './core/router.js'
import { buildGlobalMiddleware, createRouteMiddlewareResolver } from './middleware/index.js'
import { buildRoutes, registerModules } from './routes.js'

export const createKernel = (options = {}) => {
  const config = options.config ?? buildConfig()
  const logger = options.logger ?? new Logger({ filePath: config.logPath })
  const db = options.db ?? PgDb.create(config)
  const app = createContainer({ ...options, config, db, logger })
  registerModules(app)

  app.errors = new ErrorHandler({ debug: config.debug, logger })
  app.router = new Router(buildRoutes(config.apiPrefix))

  const kernel = new Kernel({
    app,
    errors: app.errors,
    router: app.router,
    globalMiddleware: buildGlobalMiddleware(app),
    resolveRouteMiddleware: createRouteMiddlewareResolver(app),
  })
  kernel.warm()
  app.kernel = kernel
  return app
}

export const createApp = (options = {}) => {
  const app = createKernel(options)
  const { config, kernel, errors } = app

  const server = express()
  server.disable('x-powered-by')
  server.set('etag', false)
  server.use(express.raw({ type: () => true, limit: config.maxBodyBytes }))

  server.use(async (req, res) => {
    const response = await kernel.handle(ApiRequest.fromNode(req, { trustProxy: config.trustProxy }))
    response.send(res)
  })

  server.use((error, _req, res, _next) => {
    const wrapped =
      error?.type === 'entity.too.large'
        ? new PayloadTooLargeError()
        : error?.status >= 400 && error?.status < 500
          ? new BadRequestError()
          : error
    errors.render(wrapped).send(res)
  })

  server.locals.container = app
  return server
}

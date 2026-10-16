import path from 'node:path'
import { createApp } from './app.js'
import { apiRoot, buildConfig, repoRoot } from './core/config.js'
import { loadEnvFiles } from './core/env.js'
import { Logger } from './core/logger.js'

loadEnvFiles(path.join(apiRoot, '.env'), path.join(repoRoot, 'backend', '.env'), path.join(repoRoot, '.env'))

const config = buildConfig()
const logger = new Logger({ filePath: config.logPath })
const server = createApp({ config, logger })

const listener = server.listen(config.port, () => {
  logger.info(`diagnocare-api listening on port ${config.port}`, { env: config.env })
})

const shutdown = (signal) => {
  logger.info(`Received ${signal}, shutting down`)
  listener.close(async () => {
    await server.locals.container.db.close?.()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection', { reason: String(reason) }))

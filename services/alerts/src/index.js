import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { config } from './config.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const app = express()

app.disable('x-powered-by')
app.use(express.json({ limit: '100kb' }))
app.use(express.static(path.resolve(here, '../public')))

app.get('/health', (_req, res) => {
  res.json({ data: { status: 'ok', service: 'diagnocare-alerts' }, error: null })
})

app.use((_req, res) => {
  res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Resource not found' } })
})

app.listen(config.port, () => {
  process.stdout.write(`diagnocare-alerts listening on port ${config.port}\n`)
})

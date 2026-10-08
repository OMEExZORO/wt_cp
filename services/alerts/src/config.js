import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const here = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(here, '../.env'), quiet: true })
dotenv.config({ path: path.resolve(here, '../../../.env'), quiet: true })

export const config = {
  port: Number.parseInt(process.env.ALERTS_SERVICE_PORT ?? '4000', 10),
  escalationMinutes: Number.parseInt(process.env.ALERT_ESCALATION_MINUTES ?? '30', 10),
  database: {
    host: process.env.DB_HOST,
    port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME ?? 'postgres',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSLMODE === 'disable' ? false : { rejectUnauthorized: false },
  },
}

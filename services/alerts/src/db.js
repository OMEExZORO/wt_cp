import pg from 'pg'
import { config } from './config.js'

const { connectionString, ssl, host, port, database, user, password } = config.database

export const pool = new pg.Pool(
  connectionString
    ? { connectionString, ssl, max: 5 }
    : { host, port, database, user, password, ssl, max: 5 },
)

pool.on('error', () => {})

export const withTransaction = async (work) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

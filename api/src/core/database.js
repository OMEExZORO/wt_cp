import pg from 'pg'

pg.types.setTypeParser(20, (value) => Number(value))
pg.types.setTypeParser(1114, (value) => value)
pg.types.setTypeParser(1184, (value) => value)
pg.types.setTypeParser(1082, (value) => value)

export class Db {
  async query(_sql, _params = []) {
    throw new Error('Db.query is not implemented')
  }

  async all(sql, params = []) {
    return (await this.query(sql, params)).rows
  }

  async one(sql, params = []) {
    return (await this.query(sql, params)).rows[0] ?? null
  }

  async value(sql, params = []) {
    const row = await this.one(sql, params)
    return row === null ? null : Object.values(row)[0]
  }

  async execute(sql, params = []) {
    return (await this.query(sql, params)).rowCount ?? 0
  }

  async tx(_work) {
    throw new Error('Db.tx is not implemented')
  }
}

const zonedClient = (timezone) => {
  const statement = `SET TIME ZONE '${timezone.replace(/[^A-Za-z0-9_/+-]/g, '')}'`
  return class ZonedClient extends pg.Client {
    connect(callback) {
      if (!callback) return super.connect().then(() => this.query(statement)).then(() => undefined)
      return super.connect((error) => {
        if (error) return callback(error)
        return this.query(statement).then(() => callback(), callback)
      })
    }
  }
}

class PgClientDb extends Db {
  constructor(client) {
    super()
    this.client = client
  }

  query(sql, params = []) {
    return this.client.query(sql, params)
  }

  async tx(work) {
    return work(this)
  }
}

export class PgDb extends Db {
  constructor(pool, timezone) {
    super()
    this.pool = pool
    this.timezone = timezone
  }

  static create(config) {
    const { connectionString, host, port, database, user, password, ssl, poolMax } = config.database
    const options = connectionString
      ? { connectionString, ssl, max: poolMax }
      : { host, port, database, user, password, ssl, max: poolMax }
    const pool = new pg.Pool({ ...options, Client: zonedClient(config.timezone) })
    pool.on('error', () => {})
    return new PgDb(pool, config.timezone)
  }

  query(sql, params = []) {
    return this.pool.query(sql, params)
  }

  async tx(work) {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await work(new PgClientDb(client))
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
  }

  async close() {
    await this.pool.end()
  }
}

const IDENTIFIER = /^[a-z0-9_]+$/

export class Model {
  static table = ''
  static primaryKey = 'id'
  static fillable = []

  constructor(db, options = {}) {
    this.db = db
    this.options = options
  }

  using(db) {
    return new this.constructor(db, this.options)
  }

  get table() {
    const { table } = this.constructor
    if (!IDENTIFIER.test(table)) throw new Error(`Invalid table name on ${this.constructor.name}`)
    return table
  }

  pickFillable(attributes) {
    const entries = Object.entries(attributes).filter(
      ([column]) => this.constructor.fillable.includes(column) && IDENTIFIER.test(column),
    )
    return Object.fromEntries(entries)
  }

  find(id) {
    return this.db.one(`SELECT * FROM ${this.table} WHERE ${this.constructor.primaryKey} = $1`, [id])
  }

  async create(attributes) {
    const data = this.pickFillable(attributes)
    const columns = Object.keys(data)
    if (columns.length === 0) throw new Error('No fillable attributes supplied')
    const placeholders = columns.map((_, index) => `$${index + 1}`)
    return this.db.one(
      `INSERT INTO ${this.table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      Object.values(data),
    )
  }

  async update(id, attributes) {
    const data = this.pickFillable(attributes)
    const columns = Object.keys(data)
    if (columns.length === 0) return this.find(id)
    const assignments = columns.map((column, index) => `${column} = $${index + 1}`).join(', ')
    return this.db.one(
      `UPDATE ${this.table} SET ${assignments} WHERE ${this.constructor.primaryKey} = $${columns.length + 1} RETURNING *`,
      [...Object.values(data), id],
    )
  }

  async delete(id) {
    return (await this.db.execute(`DELETE FROM ${this.table} WHERE ${this.constructor.primaryKey} = $1`, [id])) > 0
  }
}

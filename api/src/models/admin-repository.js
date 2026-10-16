import { Model } from './model.js'
import { ScanType } from './scan-type.js'

const escapeLike = (value) => ScanType.escapeLike(value)

const USER_COLUMNS = 'id, email, full_name, phone, role, is_active, email_verified_at, last_login_at, locked_until, created_at, updated_at'
const CHECKLIST_COLUMNS =
  'id, scan_type_id, modality, code, question, help_text, answer_type, is_required, attention_answers, sort_order, is_active'
const SLOT_COLUMNS =
  's.id, s.branch_id, s.modality, s.slot_date, s.start_time, s.end_time, s.capacity, s.booked_count, s.is_blocked, b.name AS branch_name'

const has = (filters, key) => filters[key] !== undefined && filters[key] !== null

const whereOf = (clauses) => (clauses.length === 0 ? '' : ` WHERE ${clauses.join(' AND ')}`)

export class AdminRepository extends Model {
  static table = 'users'

  users(filters, limit, offset) {
    const [where, params] = this.userWhere(filters)
    return this.db.all(`SELECT ${USER_COLUMNS} FROM users${where} ORDER BY created_at DESC, id LIMIT ${limit} OFFSET ${offset}`, params)
  }

  async userCount(filters) {
    const [where, params] = this.userWhere(filters)
    return Number(await this.db.value(`SELECT count(*) FROM users${where}`, params))
  }

  userById(id) {
    return this.db.one(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id])
  }

  async activeAdminCount() {
    return Number(await this.db.value("SELECT count(*) FROM users WHERE role = 'admin' AND is_active = TRUE"))
  }

  branches() {
    return this.db.all('SELECT * FROM branches ORDER BY sort_order, name')
  }

  categories() {
    return this.db.all(
      'SELECT c.*, p.name AS parent_name FROM scan_categories c LEFT JOIN scan_categories p ON p.id = c.parent_id ORDER BY c.modality, c.sort_order, c.name',
    )
  }

  scanTypes(filters, limit, offset) {
    const [where, params] = this.scanTypeWhere(filters)
    return this.db.all(
      `SELECT t.id, t.category_id, t.slug, t.modality, t.name, t.short_description, t.preparation_tips, t.duration_minutes, t.fee_inr,
              t.is_bookable_online, t.is_active, t.sort_order, c.name AS category_name
       FROM scan_types t JOIN scan_categories c ON c.id = t.category_id${where}
       ORDER BY t.modality, c.sort_order, t.sort_order, t.name LIMIT ${limit} OFFSET ${offset}`,
      params,
    )
  }

  async scanTypeCount(filters) {
    const [where, params] = this.scanTypeWhere(filters)
    return Number(await this.db.value(`SELECT count(*) FROM scan_types t JOIN scan_categories c ON c.id = t.category_id${where}`, params))
  }

  checklistItems(filters) {
    let sql = `SELECT i.id, i.scan_type_id, i.modality, i.code, i.question, i.help_text, i.answer_type, i.is_required, i.attention_answers,
                      i.sort_order, i.is_active, t.name AS scan_type_name
               FROM checklist_items i LEFT JOIN scan_types t ON t.id = i.scan_type_id WHERE 1 = 1`
    const params = []
    if (has(filters, 'scan_type_id')) {
      params.push(filters.scan_type_id)
      sql += ` AND i.scan_type_id = $${params.length}`
    }
    if (has(filters, 'modality')) {
      params.push(filters.modality)
      sql += ` AND (i.modality = $${params.length} OR t.modality = $${params.length})`
    }
    return this.db.all(`${sql} ORDER BY coalesce(i.modality, t.modality), i.scan_type_id NULLS FIRST, i.sort_order, i.code`, params)
  }

  checklistItem(id) {
    return this.db.one(`SELECT ${CHECKLIST_COLUMNS} FROM checklist_items WHERE id = $1`, [id])
  }

  async insertChecklistItem(data) {
    return (
      (await this.db.one(
        `INSERT INTO checklist_items (scan_type_id, modality, code, question, help_text, answer_type, is_required, attention_answers, sort_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CAST($8 AS text[]), $9, $10)
         RETURNING ${CHECKLIST_COLUMNS}`,
        [
          data.scan_type_id, data.modality, data.code, data.question, data.help_text, data.answer_type, data.is_required,
          data.attention_answers, data.sort_order, data.is_active,
        ],
      )) ?? {}
    )
  }

  updateChecklistItem(id, data) {
    return this.db.one(
      `UPDATE checklist_items SET scan_type_id = $1, modality = $2, code = $3, question = $4, help_text = $5,
              answer_type = $6, is_required = $7, attention_answers = CAST($8 AS text[]),
              sort_order = $9, is_active = $10
       WHERE id = $11
       RETURNING ${CHECKLIST_COLUMNS}`,
      [
        data.scan_type_id, data.modality, data.code, data.question, data.help_text, data.answer_type, data.is_required,
        data.attention_answers, data.sort_order, data.is_active, id,
      ],
    )
  }

  faqs() {
    return this.db.all('SELECT * FROM faqs ORDER BY sort_order, question')
  }

  settings() {
    return this.db.all(
      'SELECT key, value, value_type, group_name, label, is_public, is_placeholder, updated_at FROM site_settings ORDER BY group_name, key',
    )
  }

  async settingsByKeys(keys) {
    if (keys.length === 0) return {}
    const holders = keys.map((_, index) => `$${index + 1}`)
    const rows = await this.db.all(
      `SELECT key, value, value_type, group_name, label, is_public, is_placeholder FROM site_settings WHERE key IN (${holders.join(', ')}) FOR UPDATE`,
      keys,
    )
    return Object.fromEntries(rows.map((row) => [String(row.key), row]))
  }

  writeSetting(key, value, placeholder, userId) {
    return this.db.execute('UPDATE site_settings SET value = $1, is_placeholder = $2, updated_by_user_id = $3 WHERE key = $4', [
      value,
      placeholder,
      userId,
      key,
    ])
  }

  slots(filters, limit, offset) {
    const [where, params] = this.slotWhere(filters)
    return this.db.all(
      `SELECT ${SLOT_COLUMNS}
       FROM slots s JOIN branches b ON b.id = s.branch_id${where}
       ORDER BY s.slot_date, s.start_time, b.sort_order, s.modality LIMIT ${limit} OFFSET ${offset}`,
      params,
    )
  }

  async slotCount(filters) {
    const [where, params] = this.slotWhere(filters)
    return Number(await this.db.value(`SELECT count(*) FROM slots s${where}`, params))
  }

  slotById(id) {
    return this.db.one(`SELECT ${SLOT_COLUMNS} FROM slots s JOIN branches b ON b.id = s.branch_id WHERE s.id = $1`, [id])
  }

  lockSlot(id) {
    return this.db.one('SELECT id, capacity, booked_count, is_blocked FROM slots WHERE id = $1 FOR UPDATE', [id])
  }

  updateSlot(id, capacity, blocked) {
    return this.db.execute('UPDATE slots SET capacity = $1, is_blocked = $2 WHERE id = $3', [capacity, blocked, id])
  }

  reviews(status, limit, offset) {
    const params = []
    let where = ''
    if (status !== null && status !== undefined) {
      params.push(status)
      where = ' WHERE r.status = $1'
    }
    return this.db.all(
      `SELECT r.id, r.display_name, r.rating, r.body, r.status, r.verified_visit, r.is_demo, r.appointment_id, r.moderated_at, r.moderation_note, r.created_at, r.source, r.source_url, r.external_review_date, r.reviewer_photo_url
       FROM reviews r${where} ORDER BY (r.status = 'pending') DESC, r.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params,
    )
  }

  async reviewCount(status) {
    return status === null || status === undefined
      ? Number(await this.db.value('SELECT count(*) FROM reviews'))
      : Number(await this.db.value('SELECT count(*) FROM reviews WHERE status = $1', [status]))
  }

  userWhere(filters) {
    const clauses = []
    const params = []
    if (has(filters, 'role')) {
      params.push(filters.role)
      clauses.push(`role = $${params.length}`)
    }
    if (has(filters, 'is_active')) {
      params.push(Boolean(filters.is_active))
      clauses.push(`is_active = $${params.length}`)
    }
    if (has(filters, 'q') && filters.q !== '') {
      params.push(`%${escapeLike(String(filters.q))}%`)
      clauses.push(`(full_name ILIKE $${params.length} OR email ILIKE $${params.length})`)
    }
    return [whereOf(clauses), params]
  }

  scanTypeWhere(filters) {
    const clauses = []
    const params = []
    if (has(filters, 'modality')) {
      params.push(filters.modality)
      clauses.push(`t.modality = $${params.length}`)
    }
    if (has(filters, 'category_id')) {
      params.push(filters.category_id)
      clauses.push(`t.category_id = $${params.length}`)
    }
    if (has(filters, 'q') && filters.q !== '') {
      params.push(`%${escapeLike(String(filters.q))}%`)
      clauses.push(`t.name ILIKE $${params.length}`)
    }
    return [whereOf(clauses), params]
  }

  slotWhere(filters) {
    const clauses = []
    const params = []
    for (const [key, column] of [['branch_id', 's.branch_id'], ['modality', 's.modality']]) {
      if (has(filters, key)) {
        params.push(filters[key])
        clauses.push(`${column} = $${params.length}`)
      }
    }
    if (has(filters, 'date')) {
      params.push(filters.date)
      clauses.push(`s.slot_date = CAST($${params.length} AS date)`)
    }
    return [whereOf(clauses), params]
  }
}

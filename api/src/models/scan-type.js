import { Model } from './model.js'

const SELECT = `SELECT t.id, t.slug, t.modality, t.name, t.short_description, t.preparation_tips, t.is_bookable_online, t.sort_order,
                   c.slug AS category_slug, c.name AS category_name, p.slug AS group_slug, p.name AS group_name
            FROM scan_types t
            JOIN scan_categories c ON c.id = t.category_id
            LEFT JOIN scan_categories p ON p.id = c.parent_id`

export class ScanType extends Model {
  static table = 'scan_types'
  static fillable = [
    'category_id', 'slug', 'modality', 'name', 'short_description', 'preparation_tips',
    'duration_minutes', 'fee_inr', 'is_bookable_online', 'is_active', 'sort_order',
  ]

  static escapeLike(value) {
    return value.replace(/[\\%_]/g, '\\$&')
  }

  search(modality, query) {
    let sql = `${SELECT} WHERE t.is_active = TRUE AND c.is_active = TRUE`
    const params = []
    if (modality !== null && modality !== undefined) {
      params.push(modality)
      sql += ` AND t.modality = $${params.length}`
    }
    if (query !== null && query !== undefined && query !== '') {
      params.push(`%${ScanType.escapeLike(query)}%`)
      sql += ` AND (t.name ILIKE $${params.length} OR t.short_description ILIKE $${params.length} OR c.name ILIKE $${params.length})`
    }
    sql += ' ORDER BY t.modality, c.sort_order, t.sort_order, t.name'
    return this.db.all(sql, params)
  }

  findPublicBySlug(slug) {
    return this.db.one(`${SELECT} WHERE t.is_active = TRUE AND t.slug = $1`, [slug])
  }

  findPublicById(id) {
    return this.db.one(`${SELECT} WHERE t.is_active = TRUE AND t.id = $1`, [id])
  }

  findForBooking(id) {
    return this.db.one(
      `SELECT t.id, t.slug, t.modality, t.name, t.preparation_tips, t.duration_minutes, t.is_bookable_online
             FROM scan_types t JOIN scan_categories c ON c.id = t.category_id
             WHERE t.id = $1 AND t.is_active = TRUE AND c.is_active = TRUE`,
      [id],
    )
  }
}

import { Model } from './model.js'

export class ScanCategory extends Model {
  static table = 'scan_categories'
  static fillable = ['parent_id', 'slug', 'modality', 'name', 'tagline', 'description', 'sort_order', 'is_active']

  listActive(modality) {
    let sql = `SELECT c.id, c.slug, c.modality, c.name, c.tagline, c.description, c.sort_order, p.slug AS parent_slug,
                       (SELECT COUNT(*) FROM scan_types t WHERE t.category_id = c.id AND t.is_active = TRUE) AS scan_count
                FROM scan_categories c
                LEFT JOIN scan_categories p ON p.id = c.parent_id
                WHERE c.is_active = TRUE`
    const params = []
    if (modality !== null && modality !== undefined) {
      params.push(modality)
      sql += ` AND c.modality = $${params.length}`
    }
    sql += ' ORDER BY c.modality, c.sort_order, c.name'
    return this.db.all(sql, params)
  }
}

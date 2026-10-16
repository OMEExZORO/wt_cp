import { Model } from './model.js'

export class Faq extends Model {
  static table = 'faqs'
  static fillable = ['question', 'answer', 'category', 'sort_order', 'is_published']

  listPublished(category, limit) {
    let sql = 'SELECT id, question, answer, category, sort_order FROM faqs WHERE is_published = TRUE'
    const params = []
    if (category !== null && category !== undefined) {
      params.push(category)
      sql += ` AND category = $${params.length}`
    }
    sql += ' ORDER BY sort_order, question'
    if (limit !== null && limit !== undefined) sql += ` LIMIT ${Math.max(1, Math.min(100, limit))}`
    return this.db.all(sql, params)
  }
}

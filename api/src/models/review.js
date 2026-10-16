import { Model } from './model.js'

export class Review extends Model {
  static table = 'reviews'
  static fillable = [
    'patient_id', 'appointment_id', 'display_name', 'rating', 'body', 'status', 'verified_visit', 'is_demo',
    'moderated_by_user_id', 'moderated_at', 'moderation_note', 'source', 'source_url', 'external_review_date', 'reviewer_photo_url',
  ]

  listApproved(includeDemo, limit) {
    let sql =
      "SELECT id, display_name, rating, body, verified_visit, is_demo, created_at, source, source_url, external_review_date, reviewer_photo_url, translated_by_google FROM reviews WHERE status = 'approved'"
    if (!includeDemo) sql += ' AND is_demo = FALSE'
    sql += ` ORDER BY COALESCE(external_review_date::timestamptz, created_at) DESC LIMIT ${Math.max(1, Math.min(50, Math.trunc(limit)))}`
    return this.db.all(sql)
  }

  async approvedStats(includeDemo) {
    let sql = "SELECT COUNT(*) AS review_count, AVG(rating) AS average_rating FROM reviews WHERE status = 'approved'"
    if (!includeDemo) sql += ' AND is_demo = FALSE'
    return (await this.db.one(sql)) ?? { review_count: 0, average_rating: null }
  }
}

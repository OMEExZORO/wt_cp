import { Model } from './model.js'

export class StatsRepository extends Model {
  static table = 'appointments'

  perDayPerBranch(from, to) {
    return this.db.all(
      `SELECT s.slot_date AS day, b.id AS branch_id, b.name AS branch_name, count(*) AS total
       FROM appointments a JOIN slots s ON s.id = a.slot_id JOIN branches b ON b.id = a.branch_id
       WHERE a.status <> 'cancelled' AND s.slot_date BETWEEN CAST($1 AS date) AND CAST($2 AS date)
       GROUP BY s.slot_date, b.id, b.name ORDER BY s.slot_date, b.name`,
      [from, to],
    )
  }

  byStatus(from, to) {
    return this.db.all(
      `SELECT a.status, count(*) AS total
       FROM appointments a JOIN slots s ON s.id = a.slot_id
       WHERE s.slot_date BETWEEN CAST($1 AS date) AND CAST($2 AS date)
       GROUP BY a.status ORDER BY total DESC, a.status`,
      [from, to],
    )
  }

  byModality(from, to) {
    return this.db.all(
      `SELECT s.modality, count(*) AS total
       FROM appointments a JOIN slots s ON s.id = a.slot_id
       WHERE a.status <> 'cancelled' AND s.slot_date BETWEEN CAST($1 AS date) AND CAST($2 AS date)
       GROUP BY s.modality ORDER BY total DESC, s.modality`,
      [from, to],
    )
  }

  async pendingReviews() {
    return Number(await this.db.value("SELECT count(*) FROM reviews WHERE status = 'pending'"))
  }
}

import { Model } from './model.js'

const COLUMNS = `s.id, s.branch_id, s.modality, s.slot_date, s.start_time, s.end_time, s.capacity, s.booked_count, s.is_blocked,
                 b.name AS branch_name, b.slug AS branch_slug, b.is_active AS branch_is_active`

export class Slot extends Model {
  static table = 'slots'
  static fillable = ['branch_id', 'modality', 'slot_date', 'start_time', 'end_time', 'capacity', 'booked_count', 'is_blocked']

  forDay(branchId, modality, date) {
    return this.db.all(
      `SELECT ${COLUMNS}
       FROM slots s JOIN branches b ON b.id = s.branch_id
       WHERE s.branch_id = $1 AND s.modality = $2 AND s.slot_date = $3
       ORDER BY s.start_time`,
      [branchId, modality, date],
    )
  }

  daySummary(branchId, modality, from, to, today, nowTime) {
    return this.db.all(
      `SELECT s.slot_date,
              count(*) AS slot_count,
              COALESCE(sum(CASE WHEN s.is_blocked OR (s.slot_date = CAST($5 AS date) AND s.start_time <= CAST($6 AS time))
                                THEN 0 ELSE GREATEST(s.capacity - s.booked_count, 0) END), 0) AS remaining
       FROM slots s
       WHERE s.branch_id = $1 AND s.modality = $2
         AND s.slot_date BETWEEN CAST($3 AS date) AND CAST($4 AS date)
         AND s.slot_date >= CAST($5 AS date)
       GROUP BY s.slot_date
       ORDER BY s.slot_date`,
      [branchId, modality, from, to, today, nowTime],
    )
  }

  nextAvailable(modality, fromDate, today, nowTime, excludeBranchId = null, onlyBranchId = null, fromTime = null) {
    const params = [modality, fromDate, fromTime ?? '00:00', today, nowTime]
    let sql = `SELECT ${COLUMNS}
               FROM slots s JOIN branches b ON b.id = s.branch_id
               WHERE b.is_active = TRUE AND s.modality = $1 AND s.is_blocked = FALSE
                 AND s.booked_count < s.capacity
                 AND (s.slot_date, s.start_time) > (CAST($4 AS date), CAST($5 AS time))
                 AND (s.slot_date, s.start_time) >= (CAST($2 AS date), CAST($3 AS time))`
    if (excludeBranchId !== null) {
      params.push(excludeBranchId)
      sql += ` AND s.branch_id <> $${params.length}`
    }
    if (onlyBranchId !== null) {
      params.push(onlyBranchId)
      sql += ` AND s.branch_id = $${params.length}`
    }
    sql += ' ORDER BY s.slot_date, s.start_time, b.sort_order, b.name LIMIT 1'
    return this.db.one(sql, params)
  }

  findWithBranch(id) {
    return this.db.one(`SELECT ${COLUMNS} FROM slots s JOIN branches b ON b.id = s.branch_id WHERE s.id = $1`, [id])
  }

  lockForUpdate(id) {
    return this.db.one(`SELECT ${COLUMNS} FROM slots s JOIN branches b ON b.id = s.branch_id WHERE s.id = $1 FOR UPDATE OF s`, [id])
  }

  async lockPair(first, second) {
    const rows = await this.db.all(
      `SELECT ${COLUMNS} FROM slots s JOIN branches b ON b.id = s.branch_id
       WHERE s.id IN ($1, $2) ORDER BY s.id FOR UPDATE OF s`,
      [first, second],
    )
    return Object.fromEntries(rows.map((row) => [String(row.id), row]))
  }

  incrementBooked(id) {
    return this.db.execute('UPDATE slots SET booked_count = booked_count + 1 WHERE id = $1', [id])
  }

  releaseBooked(id) {
    return this.db.execute('UPDATE slots SET booked_count = GREATEST(booked_count - 1, 0) WHERE id = $1', [id])
  }

  async insertIgnore(rows) {
    let inserted = 0
    for (let offset = 0; offset < rows.length; offset += 1000) {
      const payload = JSON.stringify(
        rows.slice(offset, offset + 1000).map((row) => ({
          branch_id: String(row.branch_id),
          modality: String(row.modality),
          slot_date: String(row.slot_date),
          start_time: String(row.start_time),
          end_time: String(row.end_time),
          capacity: Number(row.capacity),
        })),
      )
      inserted += await this.db.execute(
        `INSERT INTO slots (branch_id, modality, slot_date, start_time, end_time, capacity)
         SELECT r.branch_id, r.modality, r.slot_date, r.start_time, r.end_time, r.capacity
         FROM jsonb_to_recordset(CAST($1 AS jsonb))
              AS r (branch_id uuid, modality text, slot_date date, start_time time, end_time time, capacity integer)
         ON CONFLICT ON CONSTRAINT slots_branch_modality_date_time_unique DO NOTHING`,
        [payload],
      )
    }
    return inserted
  }
}

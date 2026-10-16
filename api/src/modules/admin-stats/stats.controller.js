import { ok } from '../../core/response.js'
import { zonedDate } from '../../core/time.js'

const DAY_MS = 86400000

const shift = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)

export const show = async (req, app) => {
  const filters = await app.validate(req, { days: 'nullable|integer|min:7|max:90' })
  const days = Number(filters.days ?? 30)
  const toDate = zonedDate(new Date(), app.config.timezone)
  const fromDate = shift(toDate, -(days - 1))
  const stats = app.models.statsRepository

  const perDay = await stats.perDayPerBranch(fromDate, toDate)
  const totals = new Map()
  for (let i = 0; i < days; i += 1) totals.set(shift(fromDate, i), 0)
  for (const row of perDay) {
    const day = String(row.day)
    totals.set(day, (totals.get(day) ?? 0) + Number(row.total))
  }
  const byStatus = (await stats.byStatus(fromDate, toDate)).map((row) => ({ status: row.status, total: Number(row.total) }))
  const byModality = (await stats.byModality(fromDate, toDate)).map((row) => ({ modality: row.modality, total: Number(row.total) }))

  return ok({
    window: { from: fromDate, to: toDate, days },
    per_day_per_branch: perDay.map((row) => ({
      date: String(row.day),
      branch_id: row.branch_id,
      branch_name: row.branch_name,
      total: Number(row.total),
    })),
    daily_totals: [...totals].map(([date, total]) => ({ date, total })),
    by_status: byStatus,
    by_modality: byModality,
    appointments_in_window: [...totals.values()].reduce((sum, total) => sum + total, 0),
    pending_reviews: await stats.pendingReviews(),
  })
}

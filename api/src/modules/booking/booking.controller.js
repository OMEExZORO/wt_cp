import { NotFoundError, ValidationError } from '../../core/errors.js'
import { ok } from '../../core/response.js'
import { flag } from '../../models/flag.js'
import { presentSlot } from '../../services/booking/slot-presenter.js'

export const BOOKING_WINDOW_DAYS = 90

const lastBookableDate = (app) => app.services.clock.addDays(BOOKING_WINDOW_DAYS)

const addDays = (date, days) => {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

const findScan = async (app, id) => {
  const scan = await app.models.scanTypes.findForBooking(String(id).toLowerCase())
  if (scan === null) throw new NotFoundError('Scan not found.')
  return scan
}

export const availability = async (req, app) => {
  const data = await app.validate(req, {
    branch_id: 'required|uuid',
    scan_type_id: 'required|uuid',
    date: `required|date|after_or_equal:today|before_or_equal:${lastBookableDate(app)}`,
  })
  const branch = await app.models.branches.findActive(data.branch_id)
  if (branch === null) throw ValidationError.withField('branch_id', 'Choose one of our branches.')
  const scan = await findScan(app, data.scan_type_id)
  const now = app.services.clock.now()
  const rows = await app.models.slots.forDay(data.branch_id, String(scan.modality), data.date)
  const slots = rows.map((row) => presentSlot(row, now))
  const available = slots.filter((slot) => slot.is_available).length
  const suggestion =
    available === 0 ? await app.services.booking.nextAvailable(String(scan.modality), data.date, data.branch_id) : null
  return ok({
    date: data.date,
    branch: { id: branch.id, name: branch.name, slug: branch.slug },
    scan_type: { id: scan.id, name: scan.name, modality: scan.modality },
    slots,
    summary: {
      total: slots.length,
      available,
      branch_full: slots.length > 0 && available === 0,
      no_sessions: slots.length === 0,
    },
    suggestion,
  })
}

export const days = async (req, app) => {
  const clock = app.services.clock
  const last = lastBookableDate(app)
  const data = await app.validate(req, {
    branch_id: 'required|uuid',
    scan_type_id: 'required|uuid',
    from: `nullable|date|after_or_equal:today|before_or_equal:${last}`,
    days: 'nullable|integer|min:1|max:31',
  })
  if ((await app.models.branches.findActive(data.branch_id)) === null) {
    throw ValidationError.withField('branch_id', 'Choose one of our branches.')
  }
  const scan = await findScan(app, data.scan_type_id)
  const from = data.from ?? clock.today()
  let to = addDays(from, Number(data.days ?? 14) - 1)
  if (last < to) to = last
  const rows = await app.models.slots.daySummary(data.branch_id, String(scan.modality), from, to, clock.today(), clock.time())
  return ok({
    from,
    to,
    days: rows.map((row) => ({
      date: String(row.slot_date),
      slot_count: Number(row.slot_count),
      remaining: Number(row.remaining),
    })),
  })
}

export const nextAvailable = async (req, app) => {
  const data = await app.validate(req, {
    scan_type_id: 'required|uuid',
    after: `nullable|date|before_or_equal:${lastBookableDate(app)}`,
    exclude_branch_id: 'nullable|uuid',
  })
  const scan = await findScan(app, data.scan_type_id)
  const today = app.services.clock.today()
  const requested = data.after ?? today
  const after = requested > today ? requested : today
  return ok({
    suggestion: await app.services.booking.nextAvailable(String(scan.modality), after, data.exclude_branch_id ?? null),
  })
}

export const checklist = async (req, app) => {
  const scan = await findScan(app, req.param('id'))
  const items = await app.models.checklistItems.forScanType(String(scan.id), String(scan.modality))
  return ok({
    scan_type: {
      id: scan.id,
      name: scan.name,
      slug: scan.slug,
      modality: scan.modality,
      preparation_tips: scan.preparation_tips,
      is_bookable_online: flag(scan.is_bookable_online),
    },
    items: items.map((item) => ({
      id: item.id,
      code: item.code,
      question: item.question,
      help_text: item.help_text,
      answer_type: item.answer_type,
      is_required: flag(item.is_required),
    })),
  })
}

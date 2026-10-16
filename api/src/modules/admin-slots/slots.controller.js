import { ConflictError, ValidationError } from '../../core/errors.js'
import { ok } from '../../core/response.js'
import { SlotGenerator } from '../../services/booking/slot-generator.js'
import {
  deleteRecord, flag, pagination, paged, record, requireFound, uuidParam, withoutNulls,
} from '../../services/admin/admin-support.js'

export const MAX_GENERATED_ROWS = 20000

const present = (row) => ({
  id: row.id,
  branch_id: row.branch_id,
  branch_name: row.branch_name ?? null,
  modality: row.modality,
  slot_date: row.slot_date,
  start_time: String(row.start_time).slice(0, 5),
  end_time: String(row.end_time).slice(0, 5),
  capacity: Number(row.capacity),
  booked_count: Number(row.booked_count),
  is_blocked: flag(row.is_blocked),
})

const branchIdsFor = async (app, branchId) => {
  if (branchId !== null && branchId !== undefined) {
    const branch = await app.models.branches.find(branchId)
    if (branch === null || !flag(branch.is_active)) throw ValidationError.withField('branch_id', 'Choose an active branch.')
    return [branchId]
  }
  const ids = (await app.models.branches.listActive()).map((row) => String(row.id))
  if (ids.length === 0) throw ValidationError.withField('branch_id', 'There are no active branches.')
  return ids
}

export const index = async (req, app) => {
  const [page, perPage, offset] = await pagination(req, app)
  const validated = await app.validate(req, {
    branch_id: 'nullable|uuid',
    modality: 'nullable|in:USG,CT,BIOPSY',
    date: 'nullable|date',
  })
  const filters = withoutNulls(validated)
  const repository = app.models.adminRepository
  const slots = (await repository.slots(filters, perPage, offset)).map(present)
  return paged('slots', slots, await repository.slotCount(filters), page, perPage)
}

export const update = async (req, app) => {
  const id = uuidParam(req)
  const data = await app.validate(req, {
    capacity: 'sometimes|required|integer|min:1|max:50',
    is_blocked: 'sometimes|required|boolean',
  })
  if (Object.keys(data).length === 0) throw new ValidationError({ capacity: 'Provide a capacity or a blocked flag.' })
  const repository = app.models.adminRepository
  const before = requireFound(await repository.slotById(id), 'Slot')
  await app.db.tx(async (tx) => {
    const scoped = repository.using(tx)
    const locked = requireFound(await scoped.lockSlot(id), 'Slot')
    const capacity = Number(data.capacity ?? locked.capacity)
    if (capacity < Number(locked.booked_count)) {
      throw new ConflictError(`This slot already has ${Number(locked.booked_count)} booking(s); capacity cannot be lower.`, {
        capacity: 'Capacity cannot be lower than the current bookings.',
      })
    }
    const blocked = Object.hasOwn(data, 'is_blocked') ? Boolean(data.is_blocked) : flag(locked.is_blocked)
    await scoped.updateSlot(id, capacity, blocked)
  })
  await record(app, req, 'admin.slot_updated', 'slot', id, {
    capacity_before: Number(before.capacity),
    blocked_before: flag(before.is_blocked),
    fields: Object.keys(data),
  })
  return ok(present((await repository.slotById(id)) ?? before))
}

export const destroy = async (req, app) => {
  const id = uuidParam(req)
  const slot = requireFound(await app.models.adminRepository.slotById(id), 'Slot')
  if (Number(slot.booked_count) > 0) throw new ConflictError('This slot has bookings. Block it instead of deleting it.')
  return deleteRecord(app, req, app.models.slots, id, 'slot', 'Slot')
}

export const generate = async (req, app) => {
  const data = await app.validate(req, {
    from: 'required|date|after_or_equal:today',
    days: 'required|integer|min:1|max:90',
    open: 'required|time',
    close: 'required|time',
    interval: 'required|integer|min:5|max:240',
    branch_id: 'nullable|uuid',
    capacity_usg: 'nullable|integer|min:0|max:50',
    capacity_ct: 'nullable|integer|min:0|max:50',
    capacity_biopsy: 'nullable|integer|min:0|max:50',
    closed_weekdays: ['nullable', 'regex:/^[1-7](,[1-7]){0,6}$/'],
    dry_run: 'nullable|boolean',
  })

  const capacities = {}
  for (const [modality, field] of [['USG', 'capacity_usg'], ['CT', 'capacity_ct'], ['BIOPSY', 'capacity_biopsy']]) {
    const value = data[field] ?? null
    if (value !== null && Number(value) > 0) capacities[modality] = Number(value)
  }
  if (Object.keys(capacities).length === 0) {
    throw ValidationError.withField('capacity_usg', 'Set a capacity for at least one modality.')
  }

  const branchIds = await branchIdsFor(app, data.branch_id)
  const closed = String(data.closed_weekdays ?? '7').split(',').map(Number)

  let rows
  try {
    rows = SlotGenerator.plan(branchIds, capacities, data.from, Number(data.days), data.open, data.close, Number(data.interval), closed)
  } catch (error) {
    if (error instanceof RangeError) throw ValidationError.withField('close', error.message)
    throw error
  }
  if (rows.length > MAX_GENERATED_ROWS) {
    throw ValidationError.withField('days', 'That would create too many slots. Reduce the days, interval or branches.')
  }

  const dryRun = Boolean(data.dry_run ?? false)
  let inserted = 0
  if (!dryRun) {
    inserted = Number(await app.db.tx((tx) => new SlotGenerator(app.models.slots.using(tx)).insert(rows)))
    await record(app, req, 'admin.slots_generated', 'slot', 'bulk', {
      from: data.from,
      days: Number(data.days),
      candidates: rows.length,
      inserted,
      branches: branchIds.length,
    })
  }
  return ok({ candidates: rows.length, inserted, skipped_existing: dryRun ? 0 : rows.length - inserted, dry_run: dryRun })
}

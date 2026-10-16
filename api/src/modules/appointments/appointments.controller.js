import { requireUser } from '../../core/http.js'
import { NotFoundError, SlotFullError, ValidationError } from '../../core/errors.js'
import { ApiResponse, created, ok } from '../../core/response.js'
import { STATUSES, URGENCIES } from '../../models/appointment.js'
import { flag } from '../../models/flag.js'
import { appointmentIcs, presentAppointment } from '../../services/booking/appointment-presenter.js'
import { checklistRules, evaluateAnswers, prefixErrors } from '../../services/booking/checklist-evaluator.js'
import { icsFilename } from '../../services/booking/ics-calendar.js'

export const STAFF_ROLES = ['receptionist', 'doctor', 'admin']
export const BOOKING_STAFF_ROLES = ['receptionist', 'admin']

const isEmpty = (value) => value === undefined || value === null || value === '' || value === '0' || value === 0 || value === false

const render = (app, row, now, forStaff, checklist = [], attention = []) =>
  presentAppointment(row, now, forStaff, app.config.timezone, checklist, attention)

const presentFor = async (app, row, user) => {
  const isStaff = STAFF_ROLES.includes(user.role)
  const checklist = await app.models.checklistAnswers.forAppointment(String(row.id))
  const attention = isStaff
    ? checklist
        .filter((answer) => flag(answer.needs_attention))
        .map((answer) => ({ code: answer.code, question: answer.question, answer: answer.answer }))
    : []
  return render(app, row, app.services.clock.now(), isStaff, checklist, attention)
}

const authorizedRow = async (req, app, user, staffRoles = STAFF_ROLES) => {
  const row = await app.models.appointments.findDetailed(String(req.param('id')))
  if (row === null) throw new NotFoundError('Appointment not found.')
  if (user.role === 'patient' && String(row.patient_user_id) === String(user.id)) return row
  if (staffRoles.includes(user.role)) return row
  throw new NotFoundError('Appointment not found.')
}

const reload = async (app, id) => {
  const row = await app.models.appointments.findDetailed(String(id))
  if (row === null) throw new NotFoundError('Appointment not found.')
  return row
}

const ownPatient = async (app, user) => {
  const patient = await app.models.patients.findByUserId(String(user.id))
  if (patient !== null) return patient
  return app.models.patients.create({
    user_id: user.id,
    full_name: user.full_name,
    phone: user.phone ?? null,
    email: user.email,
    consent_given_at: app.services.clock.atom(),
    consent_version: String(app.config.auth.consentVersion),
  })
}

const walkInPatient = async (app, data, user, req) => {
  if (!isEmpty(data.patient_id)) {
    const patient = await app.models.patients.find(data.patient_id)
    if (patient === null) throw ValidationError.withField('patient_id', 'This patient record does not exist.')
    return patient
  }
  const existing = await app.models.patients.findWalkIn(String(data.patient_full_name), String(data.patient_phone))
  if (existing !== null) return existing
  const createdPatient = await app.models.patients.create({
    full_name: data.patient_full_name,
    phone: data.patient_phone,
    consent_given_at: app.services.clock.atom(),
    consent_version: String(app.config.auth.consentVersion),
    created_by_user_id: user.id,
  })
  await app.audit.log('patient.created_walk_in', req, { entity_type: 'patient', entity_id: createdPatient.id ?? null })
  return createdPatient
}

export const index = async (req, app) => {
  const user = requireUser(req)
  const clock = app.services.clock
  const now = clock.now()
  if (user.role === 'patient') {
    const filters = await app.validate(req, { scope: 'nullable|in:upcoming,past,all' })
    const patient = await app.models.patients.findByUserId(String(user.id))
    const rows =
      patient === null
        ? []
        : await app.models.appointments.listForPatient(String(patient.id), filters.scope ?? 'all', clock.today(), clock.time())
    const items = rows.map((row) => render(app, row, now, false))
    return ok({ appointments: items }, 200, { page: 1, per_page: items.length, total: items.length })
  }
  const filters = await app.validate(req, {
    scope: 'nullable|in:upcoming,past,all',
    date: 'nullable|date',
    from: 'nullable|date',
    to: 'nullable|date',
    branch_id: 'nullable|uuid',
    status: `nullable|in:${STATUSES.join(',')}`,
    urgency: `nullable|in:${URGENCIES.join(',')}`,
    q: 'nullable|string|max:80',
    page: 'nullable|integer|min:1|max:1000',
    per_page: 'nullable|integer|min:1|max:100',
  })
  const page = Number(filters.page ?? 1)
  const perPage = Number(filters.per_page ?? 50)
  const rows = await app.models.appointments.listForStaff(filters, clock.today(), clock.time(), perPage, (page - 1) * perPage)
  const total = await app.models.appointments.countForStaff(filters, clock.today(), clock.time())
  const attention = await app.models.checklistAnswers.attentionFor(rows.map((row) => String(row.id)))
  const items = rows.map((row) => render(app, row, now, true, [], attention[String(row.id)] ?? []))
  return ok({ appointments: items }, 200, { page, per_page: perPage, total })
}

export const show = async (req, app) => {
  const user = requireUser(req)
  const row = await authorizedRow(req, app, user)
  return ok({ appointment: await presentFor(app, row, user) })
}

export const store = async (req, app) => {
  const user = requireUser(req)
  const isStaff = BOOKING_STAFF_ROLES.includes(user.role)
  const rules = {
    scan_type_id: 'required|uuid',
    slot_id: 'required|uuid',
    consent: 'required|accepted',
    patient_notes: 'nullable|text|max:1000',
  }
  if (isStaff) {
    Object.assign(rules, {
      patient_id: 'nullable|uuid',
      patient_full_name: 'nullable|name|min:2|max:120',
      patient_phone: 'nullable|phone',
      urgency: `nullable|in:${URGENCIES.join(',')}`,
    })
  }
  let errors = {}
  let data = {}
  try {
    data = await app.validate(req, rules)
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error
    errors = { ...error.fields }
    if (errors.scan_type_id === undefined) data = await app.validate(req, { scan_type_id: 'required|uuid' })
  }

  let rawAnswers = req.body().answers ?? []
  if (typeof rawAnswers !== 'object' || (Array.isArray(rawAnswers) && rawAnswers.length > 0)) {
    errors.answers = 'Answers must be sent as an object keyed by question id.'
    rawAnswers = []
  }
  if (Array.isArray(rawAnswers)) rawAnswers = {}

  let scan = null
  let items = []
  if (data.scan_type_id !== undefined && data.scan_type_id !== null) {
    scan = await app.models.scanTypes.findForBooking(data.scan_type_id)
    if (scan === null) {
      errors.scan_type_id = 'Choose a scan from the list.'
    } else if (!isStaff && !flag(scan.is_bookable_online)) {
      errors.scan_type_id = 'This scan cannot be booked online. Please contact the centre.'
    } else {
      items = await app.models.checklistItems.forScanType(String(scan.id), String(scan.modality))
    }
  }

  let answers = {}
  try {
    answers = await app.validate(req, checklistRules(items), {}, rawAnswers)
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error
    for (const [key, message] of Object.entries(prefixErrors(error.fields))) {
      if (!(key in errors)) errors[key] = message
    }
  }

  if (
    isStaff &&
    isEmpty(data.patient_id) &&
    (isEmpty(data.patient_full_name) || isEmpty(data.patient_phone)) &&
    errors.patient_id === undefined
  ) {
    errors.patient_full_name ??= "Enter the patient's name and mobile number, or choose an existing patient."
    if (isEmpty(data.patient_phone)) errors.patient_phone ??= "Enter the patient's mobile number."
  }
  if (Object.keys(errors).length > 0 || scan === null) {
    throw new ValidationError(Object.keys(errors).length === 0 ? { scan_type_id: 'Choose a scan from the list.' } : errors)
  }

  const patient = isStaff ? await walkInPatient(app, data, user, req) : await ownPatient(app, user)
  const evaluated = evaluateAnswers(items, answers)
  const urgency = isStaff ? (data.urgency ?? 'Routine') : 'Routine'
  let id
  try {
    id = await app.services.booking.book(
      String(patient.id),
      scan,
      data.slot_id,
      evaluated,
      data.patient_notes ?? null,
      urgency,
      String(user.id),
    )
  } catch (error) {
    if (error instanceof SlotFullError) {
      await app.audit.log('booking.slot_full', req, {
        entity_type: 'slot',
        entity_id: data.slot_id,
        metadata: { suggestion_slot_id: error.suggestion?.slot?.id ?? null },
      })
    }
    throw error
  }
  const row = await reload(app, id)
  const flagged = evaluated.filter((answer) => answer.needs_attention).map((answer) => answer.code)
  await app.audit.log('booking.created', req, {
    entity_type: 'appointment',
    entity_id: id,
    metadata: {
      reference: row.reference_code,
      slot_id: row.slot_id,
      branch_id: row.branch_id,
      scan_type_id: row.scan_type_id,
      on_behalf: isStaff,
      attention_items: flagged,
    },
  })
  if (flagged.length > 0) {
    await app.audit.log('booking.attention_flagged', req, {
      entity_type: 'appointment',
      entity_id: id,
      metadata: { items: flagged },
    })
  }
  const emailSent = await app.services.appointmentNotifier.confirmed(row)
  return created({ appointment: await presentFor(app, row, user), email_sent: emailSent })
}

export const reschedule = async (req, app) => {
  const user = requireUser(req)
  const data = await app.validate(req, { slot_id: 'required|uuid' })
  const row = await authorizedRow(req, app, user, BOOKING_STAFF_ROLES)
  let change
  try {
    change = await app.services.booking.reschedule(String(row.id), data.slot_id, user.role === 'patient')
  } catch (error) {
    if (error instanceof SlotFullError) {
      await app.audit.log('booking.slot_full', req, { entity_type: 'slot', entity_id: data.slot_id })
    }
    throw error
  }
  const updated = await reload(app, row.id)
  await app.audit.log('booking.rescheduled', req, {
    entity_type: 'appointment',
    entity_id: row.id,
    metadata: { reference: row.reference_code, from: change.from, to: change.to },
  })
  const emailSent = await app.services.appointmentNotifier.rescheduled(updated, change.from)
  return ok({ appointment: await presentFor(app, updated, user), email_sent: emailSent })
}

export const cancel = async (req, app) => {
  const user = requireUser(req)
  const data = await app.validate(req, { reason: 'nullable|text|max:500' })
  const row = await authorizedRow(req, app, user, BOOKING_STAFF_ROLES)
  await app.services.booking.cancel(String(row.id), data.reason ?? null, user.role === 'patient')
  const updated = await reload(app, row.id)
  await app.audit.log('booking.cancelled', req, {
    entity_type: 'appointment',
    entity_id: row.id,
    metadata: { reference: row.reference_code, slot_id: row.slot_id, by: user.role },
  })
  const emailSent = await app.services.appointmentNotifier.cancelled(updated)
  return ok({ appointment: await presentFor(app, updated, user), email_sent: emailSent })
}

export const updateStatus = async (req, app) => {
  const user = requireUser(req)
  const data = await app.validate(req, {
    status: 'nullable|in:checked_in,in_progress,completed,no_show',
    urgency: `nullable|in:${URGENCIES.join(',')}`,
  })
  const status = data.status ?? null
  const urgency = data.urgency ?? null
  if (status === null && urgency === null) throw new ValidationError({ status: 'Choose a new status or urgency.' })
  const row = await authorizedRow(req, app, user, STAFF_ROLES)
  const change = await app.services.booking.changeStatus(String(row.id), status, urgency)
  if (change.status.from !== change.status.to) {
    await app.audit.log('booking.status_changed', req, {
      entity_type: 'appointment',
      entity_id: row.id,
      metadata: { reference: row.reference_code, ...change.status },
    })
  }
  if (change.urgency.from !== change.urgency.to) {
    await app.audit.log('booking.urgency_changed', req, {
      entity_type: 'appointment',
      entity_id: row.id,
      metadata: { reference: row.reference_code, ...change.urgency },
    })
  }
  const updated = await reload(app, row.id)
  return ok({ appointment: await presentFor(app, updated, user) })
}

export const ics = async (req, app) => {
  const user = requireUser(req)
  const row = await authorizedRow(req, app, user)
  const notifier = app.services.appointmentNotifier
  const body = appointmentIcs(row, app.services.clock.now(), notifier.domain(), notifier.portalUrl(row))
  return ApiResponse.binary(Buffer.from(body, 'utf8'), 200, {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': `attachment; filename="${icsFilename(String(row.reference_code))}"`,
  })
}

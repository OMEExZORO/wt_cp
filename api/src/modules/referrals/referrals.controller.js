import { randomInt } from 'node:crypto'
import { AuthorizationError, NotFoundError, ValidationError } from '../../core/errors.js'
import { requireUser } from '../../core/http.js'
import { atomTimestamp, toIso, zonedDate } from '../../core/time.js'
import { created, ok } from '../../core/response.js'
import { Referral } from '../../models/referral.js'
import { encryptionOf, reportServices } from '../../services/reports/context.js'

const STAFF_ROLES = ['receptionist', 'doctor', 'admin']
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

const isStaff = (user) => STAFF_ROLES.includes(user.role)

const authorized = async (req, app, user) => {
  const row = await app.models.referrals.findDetailed(String(req.param('id')))
  if (row === null) throw new NotFoundError('Referral not found.')
  if (isStaff(user)) return row
  if (user.role === 'referrer' && String(row.referrer_user_id) === String(user.id)) return row
  throw new NotFoundError('Referral not found.')
}

const scopeReferrerId = async (app, user) => {
  if (isStaff(user)) return null
  const referrer = await app.models.referrers.findByUserId(String(user.id))
  if (referrer === null) throw new AuthorizationError('Your referrer profile is not set up.')
  return String(referrer.id)
}

const present = async (app, row, user, withReports) => {
  const { reportPresenter } = reportServices(app)
  const staff = isStaff(user)
  const timezone = app.config.timezone
  const data = {
    id: row.id,
    reference_code: row.reference_code,
    patient_name: row.patient_name,
    patient_phone: row.patient_phone,
    patient_email: row.patient_email,
    scan_type: row.scan_type_id === null ? null : { id: row.scan_type_id, name: row.scan_name, modality: row.scan_modality },
    preferred_branch: row.preferred_branch_id === null ? null : { id: row.preferred_branch_id, name: row.branch_name },
    urgency: row.urgency,
    status: row.status,
    status_changed_at: toIso(row.status_changed_at, timezone),
    created_at: toIso(row.created_at, timezone),
    appointment:
      row.appointment_id === null
        ? null
        : {
            id: row.appointment_id,
            reference_code: row.appointment_reference,
            status: row.appointment_status,
            date: row.appointment_date,
            time: row.appointment_time === null || row.appointment_time === undefined ? null : String(row.appointment_time).slice(0, 5),
          },
    clinical_notes: encryptionOf(app).decryptNullable(row.clinical_notes_encrypted ?? null),
  }
  if (staff) data.referrer = { name: row.referrer_name, clinic_name: row.referrer_clinic }
  if (withReports) {
    const reports = staff
      ? await app.models.reports.allForReferral(String(row.id))
      : await app.models.reports.releasedForReferral(String(row.id))
    data.reports = reports.map((report) => reportPresenter.summary(report))
  }
  return data
}

const uniqueCode = async (app) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    let suffix = ''
    for (let i = 0; i < 6; i += 1) suffix += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)]
    const code = `RF-${zonedDate(new Date(), app.config.timezone).slice(2).replaceAll('-', '')}-${suffix}`
    if (!(await app.models.referrals.referenceExists(code))) return code
  }
  throw new Error('Could not allocate a referral reference.')
}

export const index = async (req, app) => {
  const user = requireUser(req)
  const filters = await app.validate(req, {
    status: `nullable|in:${Referral.STATUSES.join(',')}`,
    q: 'nullable|string|max:80',
    page: 'nullable|integer|min:1|max:1000',
    per_page: 'nullable|integer|min:1|max:100',
  })
  const referrerId = await scopeReferrerId(app, user)
  const page = Number(filters.page ?? 1)
  const perPage = Number(filters.per_page ?? 20)
  const rows = await app.models.referrals.list(filters, referrerId, perPage, (page - 1) * perPage)
  const total = await app.models.referrals.count(filters, referrerId)
  const items = []
  for (const row of rows) items.push(await present(app, row, user, true))
  return ok({ referrals: items }, 200, { page, per_page: perPage, total })
}

export const store = async (req, app) => {
  const user = requireUser(req)
  const data = await app.validate(req, {
    patient_name: 'required|name|min:2|max:120',
    patient_phone: 'required|phone',
    patient_email: 'nullable|email|max:254',
    scan_type_id: 'required|uuid',
    preferred_branch_id: 'nullable|uuid',
    urgency: `nullable|in:${Referral.URGENCIES.join(',')}`,
    clinical_notes: 'nullable|text|max:2000',
  })
  const referrer = await app.models.referrers.findByUserId(String(user.id))
  if (referrer === null) throw new AuthorizationError('Your referrer profile is not set up.')
  const errors = {}
  if ((await app.models.referrals.findScanType(data.scan_type_id)) === null) errors.scan_type_id = 'Choose a scan from the list.'
  if (data.preferred_branch_id && (await app.models.referrals.findActiveBranch(data.preferred_branch_id)) === null) {
    errors.preferred_branch_id = 'Choose a branch from the list.'
  }
  if (Object.keys(errors).length > 0) throw new ValidationError(errors)

  const createdRow = await app.models.referrals.create({
    reference_code: await uniqueCode(app),
    referrer_id: referrer.id,
    patient_name: data.patient_name,
    patient_phone: data.patient_phone,
    patient_email: data.patient_email ?? null,
    scan_type_id: data.scan_type_id,
    preferred_branch_id: data.preferred_branch_id ?? null,
    urgency: data.urgency ?? 'Routine',
    clinical_notes_encrypted: encryptionOf(app).encryptNullable(data.clinical_notes ?? null),
  })
  await app.audit.log('referral.created', req, {
    entity_type: 'referral',
    entity_id: createdRow.id,
    metadata: { reference: createdRow.reference_code, scan_type_id: data.scan_type_id, urgency: createdRow.urgency },
  })
  const row = await app.models.referrals.findDetailed(String(createdRow.id))
  if (row === null) throw new NotFoundError('Referral not found.')
  return created({ referral: await present(app, row, user, true) })
}

export const show = async (req, app) => {
  const user = requireUser(req)
  const row = await authorized(req, app, user)
  return ok({ referral: await present(app, row, user, true) })
}

export const update = async (req, app) => {
  const user = requireUser(req)
  const data = await app.validate(req, {
    status: `sometimes|required|in:${Referral.STAFF_STATUSES.join(',')}`,
    appointment_id: 'sometimes|required|uuid',
  })
  if (Object.keys(data).length === 0) throw new ValidationError({ status: 'Choose a new status or an appointment to link.' })
  const row = await authorized(req, app, user)

  let appointment = null
  if (data.appointment_id !== undefined) {
    appointment = await app.models.referrals.findAppointment(data.appointment_id)
    if (appointment === null || appointment.status === 'cancelled') {
      throw ValidationError.withField('appointment_id', 'Choose an existing, non-cancelled appointment.')
    }
    if (appointment.referral_id && String(appointment.referral_id) !== String(row.id)) {
      throw ValidationError.withField('appointment_id', 'This appointment is already linked to another referral.')
    }
    if (row.patient_id && String(row.patient_id) !== String(appointment.patient_id)) {
      throw ValidationError.withField('appointment_id', 'This appointment belongs to a different patient.')
    }
  }

  let status = data.status ?? null
  if (status === null && appointment !== null && ['submitted', 'accepted'].includes(row.status)) status = 'scheduled'

  await app.db.tx(async (tx) => {
    const referrals = app.models.referrals.using(tx)
    const changes = {}
    if (appointment !== null) {
      await referrals.linkAppointment(String(row.id), String(appointment.id))
      changes.patient_id = appointment.patient_id
    }
    if (status !== null && status !== row.status) {
      changes.status = status
      changes.status_changed_at = atomTimestamp(new Date(), app.config.timezone)
    }
    if (Object.keys(changes).length > 0) await referrals.update(String(row.id), changes)
  })

  await app.audit.log('referral.updated', req, {
    entity_type: 'referral',
    entity_id: row.id,
    metadata: {
      reference: row.reference_code,
      from_status: row.status,
      to_status: status ?? row.status,
      appointment_id: appointment?.id ?? null,
    },
  })
  const updated = await app.models.referrals.findDetailed(String(row.id))
  if (updated === null) throw new NotFoundError('Referral not found.')
  return ok({ referral: await present(app, updated, user, true) })
}

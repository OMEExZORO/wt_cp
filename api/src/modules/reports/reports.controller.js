import { NotFoundError, PayloadTooLargeError, ValidationError } from '../../core/errors.js'
import { requireUser } from '../../core/http.js'
import { ApiResponse, created, noContent, ok } from '../../core/response.js'
import { Report } from '../../models/report.js'
import { canDelete, canView } from '../../services/reports/report-access-policy.js'
import { reportServices } from '../../services/reports/context.js'
import { MAX_BYTES, cleanName } from '../../services/reports/uploaded-file-validator.js'
import { parseMultipart } from '../../services/uploads.js'

const authorized = async (req, app, user) => {
  const row = await app.models.reports.findDetailed(String(req.param('id')))
  if (row === null) throw new NotFoundError('Report not found.')
  if (!canView(user, row)) {
    await app.models.reportAccessLog.record(String(row.id), String(user.id), 'denied', req.ip, req.userAgent)
    await app.audit.log('report.access_denied', req, { entity_type: 'report', entity_id: row.id })
    throw new NotFoundError('Report not found.')
  }
  return row
}

export const index = async (req, app) => {
  const user = requireUser(req)
  const { reportPresenter } = reportServices(app)
  const filters = await app.validate(req, {
    patient_id: 'nullable|uuid',
    appointment_id: 'nullable|uuid',
    status: `nullable|in:${Report.STATUSES.join(',')}`,
    q: 'nullable|string|max:80',
    from: 'nullable|date',
    to: 'nullable|date',
    page: 'nullable|integer|min:1|max:1000',
    per_page: 'nullable|integer|min:1|max:100',
  })
  const page = Number(filters.page ?? 1)
  const perPage = Number(filters.per_page ?? 20)
  const rows = (await app.models.reports.listVisible(user, filters, perPage, (page - 1) * perPage)).filter((row) => canView(user, row))
  const total = await app.models.reports.countVisible(user, filters)
  return ok({ reports: rows.map((row) => reportPresenter.summary(row)) }, 200, { page, per_page: perPage, total })
}

export const store = async (req, app) => {
  const user = requireUser(req)
  const services = reportServices(app)
  const { reportFiles, reportService, reportPresenter } = services
  const declared = Number.parseInt(req.header('content-length', '0'), 10) || 0
  if (declared > MAX_BYTES + 1048576) {
    throw new PayloadTooLargeError('The file is too large. The limit is 10 MB.', { file: 'The file is too large. The limit is 10 MB.' })
  }
  const { fields, files } = await parseMultipart(req, { maxFileBytes: reportFiles.maxBytes })
  const data = await app.validate(
    req,
    {
      appointment_id: 'required|uuid',
      patient_id: 'nullable|uuid',
      title: 'required|string|min:2|max:200',
      notes: 'nullable|text|max:5000',
      impression: 'nullable|text|max:5000',
      status: 'nullable|in:draft,final',
    },
    {},
    fields,
  )

  const appointment = await app.models.reports.findAppointment(data.appointment_id)
  if (appointment === null || appointment.status === 'cancelled') {
    throw ValidationError.withField('appointment_id', 'Choose an existing, non-cancelled appointment.')
  }
  if (data.patient_id && String(data.patient_id) !== String(appointment.patient_id)) {
    throw ValidationError.withField('patient_id', 'This appointment belongs to a different patient.')
  }

  const upload = reportFiles.validate(files.file)

  const id = await reportService.store(
    user,
    appointment,
    upload,
    { title: data.title, notes: data.notes ?? null, impression: data.impression ?? null, status: data.status ?? 'final' },
    req.ip,
    req.userAgent,
  )

  await app.audit.log('report.uploaded', req, {
    entity_type: 'report',
    entity_id: id,
    metadata: {
      appointment_id: appointment.id,
      patient_id: appointment.patient_id,
      mime_type: upload.mime_type,
      size_bytes: upload.size_bytes,
    },
  })

  const row = (await app.models.reports.findDetailed(id)) ?? (() => { throw new NotFoundError('Report not found.') })()
  return created({ report: reportPresenter.detail(row, user) })
}

export const show = async (req, app) => {
  const user = requireUser(req)
  const { reportPresenter } = reportServices(app)
  const row = await authorized(req, app, user)
  await app.models.reportAccessLog.record(String(row.id), String(user.id), 'view', req.ip, req.userAgent)
  return ok({ report: reportPresenter.detail(row, user) })
}

export const download = async (req, app) => {
  const user = requireUser(req)
  const { reportService } = reportServices(app)
  const row = await authorized(req, app, user)
  const plaintext = await reportService.read(row)
  await app.models.reportAccessLog.record(String(row.id), String(user.id), 'download', req.ip, req.userAgent)
  await app.audit.log('report.downloaded', req, { entity_type: 'report', entity_id: row.id })

  let filename = cleanName(String(row.original_filename))
  if (filename === '') filename = 'report'
  return ApiResponse.binary(plaintext, 200, {
    'Content-Type': String(row.mime_type),
    'Content-Length': String(plaintext.length),
    'Content-Disposition': `attachment; filename="${filename.replaceAll('"', '')}"`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store, max-age=0',
    Pragma: 'no-cache',
  })
}

export const update = async (req, app) => {
  const user = requireUser(req)
  const { reportService, reportPresenter } = reportServices(app)
  const data = await app.validate(req, {
    title: 'sometimes|required|string|min:2|max:200',
    notes: 'sometimes|nullable|text|max:5000',
    impression: 'sometimes|nullable|text|max:5000',
    status: `sometimes|required|in:${Report.STATUSES.join(',')}`,
  })
  if (Object.keys(data).length === 0) throw new ValidationError({ title: 'Provide at least one field to update.' })
  const row = await authorized(req, app, user)
  await reportService.update(row, data)
  await app.audit.log('report.updated', req, {
    entity_type: 'report',
    entity_id: row.id,
    metadata: { fields: Object.keys(data), status: data.status ?? null },
  })
  const updated = await app.models.reports.findDetailed(String(row.id))
  if (updated === null) throw new NotFoundError('Report not found.')
  return ok({ report: reportPresenter.detail(updated, user) })
}

export const destroy = async (req, app) => {
  const user = requireUser(req)
  const { reportService } = reportServices(app)
  if (!canDelete(user)) throw new NotFoundError('Report not found.')
  const row = await authorized(req, app, user)
  await reportService.remove(row)
  await app.models.reportAccessLog.record(String(row.id), String(user.id), 'delete', req.ip, req.userAgent)
  await app.audit.log('report.deleted', req, { entity_type: 'report', entity_id: row.id })
  return noContent()
}

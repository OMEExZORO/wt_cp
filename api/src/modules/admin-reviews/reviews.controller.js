import { ValidationError } from '../../core/errors.js'
import { requireUser } from '../../core/http.js'
import { created, ok } from '../../core/response.js'
import { sqlTimestamp, toIso } from '../../core/time.js'
import {
  HTTPS_URL_PATTERN, changedFields, flag, pagination, paged, record, requireFound, runWrite, uuidParam,
} from '../../services/admin/admin-support.js'

const SAVE_FAILED = 'This review could not be saved.'

const googleRules = () => ({
  display_name: 'required|min:1|max:80',
  rating: 'required|integer|min:1|max:5',
  body: 'required|text|min:10|max:2000',
  external_review_date: 'required|date|after:2000-01-01|before_or_equal:today',
  source_url: ['nullable', 'max:500', `regex:${HTTPS_URL_PATTERN}`],
  reviewer_photo_url: ['nullable', 'max:500', `regex:${HTTPS_URL_PATTERN}`],
})

const googleAttributes = (data) => ({
  display_name: data.display_name,
  rating: Number(data.rating),
  body: data.body,
  external_review_date: data.external_review_date,
  source_url: data.source_url ?? null,
  reviewer_photo_url: data.reviewer_photo_url ?? null,
  source: 'google',
})

const present = (row, app) => ({
  id: row.id,
  display_name: row.display_name,
  rating: Number(row.rating),
  body: row.body,
  status: row.status,
  verified_visit: flag(row.verified_visit),
  is_demo: flag(row.is_demo),
  source: row.source ?? 'site',
  source_url: row.source_url ?? null,
  external_review_date: row.external_review_date ?? null,
  reviewer_photo_url: row.reviewer_photo_url ?? null,
  moderation_note: row.moderation_note ?? null,
  moderated_at: toIso(row.moderated_at ?? null, app.config.timezone),
  created_at: toIso(row.created_at ?? null, app.config.timezone),
})

export const index = async (req, app) => {
  const [page, perPage, offset] = await pagination(req, app)
  const filters = await app.validate(req, { status: 'nullable|in:pending,approved,rejected' })
  const status = filters.status ?? null
  const repository = app.models.adminRepository
  const rows = (await repository.reviews(status, perPage, offset)).map((row) => present(row, app))
  return paged('reviews', rows, await repository.reviewCount(status), page, perPage)
}

export const store = async (req, app) => {
  const actor = requireUser(req)
  const data = await app.validate(req, googleRules())
  const row = await runWrite(
    () =>
      app.models.reviews.create({
        ...googleAttributes(data),
        status: 'approved',
        verified_visit: false,
        is_demo: false,
        moderated_by_user_id: actor.id,
        moderated_at: sqlTimestamp(new Date(), app.config.timezone),
      }),
    SAVE_FAILED,
  )
  await record(app, req, 'admin.review_created', 'review', String(row.id), { source: 'google' })
  return created(present(row, app))
}

export const update = async (req, app) => {
  const id = uuidParam(req)
  const data = await app.validate(req, googleRules())
  const before = requireFound(await app.models.reviews.find(id), 'Review')
  if ((before.source ?? 'site') !== 'google') {
    throw new ValidationError({ _: 'Only reviews entered from Google can be edited.' })
  }
  const attributes = googleAttributes(data)
  const row = requireFound(await runWrite(() => app.models.reviews.update(id, attributes), SAVE_FAILED), 'Review')
  await record(app, req, 'admin.review_updated', 'review', id, { fields: changedFields(before, attributes) })
  return ok(present(row, app))
}

export const moderate = async (req, app) => {
  const id = uuidParam(req)
  const actor = requireUser(req)
  const data = await app.validate(req, {
    status: 'required|in:pending,approved,rejected',
    moderation_note: 'nullable|text|max:500',
  })
  const before = requireFound(await app.models.reviews.find(id), 'Review')
  const row = requireFound(
    await app.models.reviews.update(id, {
      status: data.status,
      moderation_note: data.moderation_note ?? null,
      moderated_by_user_id: actor.id,
      moderated_at: data.status === 'pending' ? null : sqlTimestamp(new Date(), app.config.timezone),
    }),
    'Review',
  )
  await record(app, req, `admin.review_${data.status}`, 'review', id, { from: before.status })
  return ok(present(row, app))
}

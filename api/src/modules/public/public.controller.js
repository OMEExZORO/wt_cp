import { NotFoundError } from '../../core/errors.js'
import { ok } from '../../core/response.js'
import {
  presentBranch,
  presentDoctor,
  presentReview,
  presentReviewSummary,
  presentScanType,
  presentSettings,
} from '../../services/public-content-presenter.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const site = async (req, app) => ok({ settings: presentSettings(await app.models.siteSettings.publicRows()) })

export const doctor = async (req, app) => {
  const settings = presentSettings(await app.models.siteSettings.publicRows())
  return ok({ doctor: presentDoctor(Array.isArray(settings) ? {} : settings) })
}

export const branches = async (req, app) => {
  const rows = await app.models.branches.listActive()
  return ok({ branches: rows.map(presentBranch) })
}

export const scanCategories = async (req, app) => {
  const filters = await app.validate(req, { modality: 'nullable|in:USG,CT,BIOPSY' })
  const rows = await app.models.scanCategories.listActive(filters.modality ?? null)
  return ok({
    categories: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      modality: row.modality,
      name: row.name,
      tagline: row.tagline,
      description: row.description,
      parent_slug: row.parent_slug,
      scan_count: Number(row.scan_count),
    })),
  })
}

export const scanTypes = async (req, app) => {
  const filters = await app.validate(req, { modality: 'nullable|in:USG,CT,BIOPSY', q: 'nullable|string|max:80' })
  const rows = await app.models.scanTypes.search(filters.modality ?? null, filters.q ?? null)
  return ok({ scan_types: rows.map(presentScanType) }, 200, { total: rows.length })
}

export const scanType = async (req, app) => {
  const ref = String(req.param('ref'))
  const row = UUID.test(ref)
    ? await app.models.scanTypes.findPublicById(ref.toLowerCase())
    : await app.models.scanTypes.findPublicBySlug(ref)
  if (row === null) throw new NotFoundError('Scan not found.')
  return ok({ scan_type: presentScanType(row) })
}

export const faqs = async (req, app) => {
  const filters = await app.validate(req, {
    category: 'nullable|in:general,booking,preparation,reports,privacy',
    limit: 'nullable|integer|min:1|max:50',
  })
  const limit = filters.limit === undefined || filters.limit === null ? null : Number(filters.limit)
  return ok({ faqs: await app.models.faqs.listPublished(filters.category ?? null, limit) })
}

export const reviews = async (req, app) => {
  const filters = await app.validate(req, { limit: 'nullable|integer|min:1|max:50' })
  const limit = filters.limit === undefined || filters.limit === null ? 12 : Number(filters.limit)
  const includeDemo = String(app.config.env) !== 'production'
  const rows = await app.models.reviews.listApproved(includeDemo, limit)
  return ok({
    reviews: rows.map((row) => presentReview(row, includeDemo, app.config.timezone)),
    summary: presentReviewSummary(await app.models.reviews.approvedStats(includeDemo)),
  })
}

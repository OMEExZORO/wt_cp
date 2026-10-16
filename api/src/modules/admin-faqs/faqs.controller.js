import { created, ok } from '../../core/response.js'
import { createRecord, deleteRecord, flag, partial, updateRecord, uuidParam } from '../../services/admin/admin-support.js'

const CONFLICT = 'A FAQ with this question already exists.'

const rules = () => ({
  question: 'required|min:5|max:300',
  answer: 'required|text|min:5|max:2000',
  category: 'required|in:general,booking,preparation,reports,privacy',
  sort_order: 'integer|min:0|max:1000',
  is_published: 'boolean',
})

const present = (row) => ({
  id: row.id,
  question: row.question,
  answer: row.answer,
  category: row.category,
  sort_order: Number(row.sort_order),
  is_published: flag(row.is_published),
})

export const index = async (_req, app) => ok({ faqs: (await app.models.adminRepository.faqs()).map(present) })

export const store = async (req, app) => {
  const data = await app.validate(req, rules())
  return created(present(await createRecord(app, req, app.models.faqs, data, 'faq', CONFLICT)))
}

export const update = async (req, app) => {
  const data = await app.validate(req, partial(req, rules()))
  return ok(present(await updateRecord(app, req, app.models.faqs, uuidParam(req), data, 'faq', 'FAQ', CONFLICT)))
}

export const destroy = (req, app) => deleteRecord(app, req, app.models.faqs, uuidParam(req), 'faq', 'FAQ')

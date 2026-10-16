import { ValidationError } from '../../core/errors.js'
import { created, ok } from '../../core/response.js'
import {
  SLUG_PATTERN, createRecord, deleteRecord, flag, pagination, paged, partial, record, requireFound, runWrite,
  updateRecord, uuidParam, withoutNulls,
} from '../../services/admin/admin-support.js'

export const MODALITIES = 'USG,CT,BIOPSY'
export const ANSWER_TYPES = 'yes_no,yes_no_unsure,text,date'
const ATTENTION_VALUES = ['yes', 'no', 'unsure']
const SCAN_CONFLICT = 'A scan with this slug already exists.'
const CATEGORY_CONFLICT = 'A category with this slug already exists.'
const ITEM_CONFLICT = 'A checklist item with this code already exists.'

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

export const parseAttentionAnswers = (raw, answerType) => {
  if (raw === null || raw === undefined || (Array.isArray(raw) && raw.length === 0) || (isPlainObject(raw) && Object.keys(raw).length === 0)) {
    return []
  }
  if (!Array.isArray(raw) || raw.length > 3) {
    throw ValidationError.withField('attention_answers', 'Provide up to three answers as a list.')
  }
  if (!['yes_no', 'yes_no_unsure'].includes(answerType)) {
    throw ValidationError.withField('attention_answers', 'Attention answers apply only to yes or no questions.')
  }
  const allowed = answerType === 'yes_no' ? ['yes', 'no'] : ATTENTION_VALUES
  const clean = new Set()
  for (const value of raw) {
    if (typeof value !== 'string' || !allowed.includes(value)) {
      throw ValidationError.withField('attention_answers', `Use only ${allowed.join(', ')}.`)
    }
    clean.add(value)
  }
  return [...clean]
}

const decodeArray = (value) => {
  if (Array.isArray(value)) return value
  const text = String(value ?? '').replace(/^[{}]+|[{}]+$/g, '')
  return text === '' ? [] : text.split(',')
}

const categoryRules = () => ({
  parent_id: 'nullable|uuid',
  slug: ['required', 'max:80', `regex:${SLUG_PATTERN}`],
  modality: `required|in:${MODALITIES}`,
  name: 'required|min:2|max:120',
  tagline: 'nullable|max:160',
  description: 'nullable|text|max:1000',
  sort_order: 'integer|min:0|max:1000',
  is_active: 'boolean',
})

const typeRules = () => ({
  category_id: 'required|uuid',
  slug: ['required', 'max:80', `regex:${SLUG_PATTERN}`],
  modality: `required|in:${MODALITIES}`,
  name: 'required|min:2|max:120',
  short_description: 'required|text|min:5|max:600',
  preparation_tips: 'required|text|min:5|max:2000',
  duration_minutes: 'integer|min:5|max:240',
  fee_inr: ['nullable', 'regex:/^\\d{1,8}(\\.\\d{1,2})?$/'],
  is_bookable_online: 'boolean',
  is_active: 'boolean',
  sort_order: 'integer|min:0|max:1000',
})

const checklistRules = () => ({
  scan_type_id: 'nullable|uuid',
  modality: `nullable|in:${MODALITIES}`,
  code: ['required', 'max:80', 'regex:/^[a-z0-9]+(_[a-z0-9]+)*$/'],
  question: 'required|min:5|max:300',
  help_text: 'nullable|text|max:500',
  answer_type: `required|in:${ANSWER_TYPES}`,
  is_required: 'boolean',
  sort_order: 'integer|min:0|max:1000',
  is_active: 'boolean',
})

const presentCategory = (row) => ({
  id: row.id,
  parent_id: row.parent_id,
  parent_name: row.parent_name ?? null,
  slug: row.slug,
  modality: row.modality,
  name: row.name,
  tagline: row.tagline,
  description: row.description,
  sort_order: Number(row.sort_order),
  is_active: flag(row.is_active),
})

const presentType = (row) => ({
  id: row.id,
  category_id: row.category_id,
  category_name: row.category_name ?? null,
  slug: row.slug,
  modality: row.modality,
  name: row.name,
  short_description: row.short_description,
  preparation_tips: row.preparation_tips,
  duration_minutes: Number(row.duration_minutes),
  fee_inr: row.fee_inr === null ? null : Number(row.fee_inr),
  is_bookable_online: flag(row.is_bookable_online),
  is_active: flag(row.is_active),
  sort_order: Number(row.sort_order),
})

const presentItem = (row) => ({
  id: row.id,
  scan_type_id: row.scan_type_id,
  scan_type_name: row.scan_type_name ?? null,
  modality: row.modality,
  code: row.code,
  question: row.question,
  help_text: row.help_text,
  answer_type: row.answer_type,
  is_required: flag(row.is_required),
  attention_answers: decodeArray(row.attention_answers),
  sort_order: Number(row.sort_order),
  is_active: flag(row.is_active),
})

const assertModalityMatchesCategory = async (app, categoryId, modality) => {
  const category = await app.models.scanCategories.find(categoryId)
  if (category === null) throw ValidationError.withField('category_id', 'Choose an existing category.')
  if (category.modality !== modality) throw ValidationError.withField('modality', 'The scan modality must match its category.')
}

export const categoryIndex = async (_req, app) =>
  ok({ categories: (await app.models.adminRepository.categories()).map(presentCategory) })

export const categoryStore = async (req, app) => {
  const data = await app.validate(req, categoryRules())
  return created(presentCategory(await createRecord(app, req, app.models.scanCategories, data, 'scan_category', CATEGORY_CONFLICT)))
}

export const categoryUpdate = async (req, app) => {
  const id = uuidParam(req)
  const data = await app.validate(req, partial(req, categoryRules()))
  if (data.parent_id !== undefined && data.parent_id !== null && data.parent_id === id) {
    throw ValidationError.withField('parent_id', 'A category cannot be its own parent.')
  }
  return ok(presentCategory(await updateRecord(app, req, app.models.scanCategories, id, data, 'scan_category', 'Category', CATEGORY_CONFLICT)))
}

export const categoryDestroy = (req, app) =>
  deleteRecord(app, req, app.models.scanCategories, uuidParam(req), 'scan_category', 'Category')

export const typeIndex = async (req, app) => {
  const [page, perPage, offset] = await pagination(req, app)
  const validated = await app.validate(req, {
    modality: `nullable|in:${MODALITIES}`,
    category_id: 'nullable|uuid',
    q: 'nullable|string|max:80',
  })
  const filters = withoutNulls(validated)
  const repository = app.models.adminRepository
  const rows = (await repository.scanTypes(filters, perPage, offset)).map(presentType)
  return paged('scan_types', rows, await repository.scanTypeCount(filters), page, perPage)
}

export const typeStore = async (req, app) => {
  const data = await app.validate(req, typeRules())
  await assertModalityMatchesCategory(app, String(data.category_id), String(data.modality))
  return created(presentType(await createRecord(app, req, app.models.scanTypes, data, 'scan_type', SCAN_CONFLICT)))
}

export const typeUpdate = async (req, app) => {
  const id = uuidParam(req)
  const data = await app.validate(req, partial(req, typeRules()))
  const existing = requireFound(await app.models.scanTypes.find(id), 'Scan type')
  await assertModalityMatchesCategory(
    app,
    String(data.category_id ?? existing.category_id),
    String(data.modality ?? existing.modality),
  )
  return ok(presentType(await updateRecord(app, req, app.models.scanTypes, id, data, 'scan_type', 'Scan type', SCAN_CONFLICT)))
}

export const typeDestroy = (req, app) => deleteRecord(app, req, app.models.scanTypes, uuidParam(req), 'scan_type', 'Scan type')

const mergeChecklist = (req, existing, data) => {
  if (req.method !== 'PATCH') return data
  const merged = { ...data }
  if (merged.scan_type_id !== undefined && merged.scan_type_id !== null && merged.modality === undefined) merged.modality = null
  if (merged.modality !== undefined && merged.modality !== null && merged.scan_type_id === undefined) merged.scan_type_id = null
  return { ...existing, attention_answers: decodeArray(existing.attention_answers), ...merged }
}

const checklistPayload = (req, data) => {
  const scanTypeId = data.scan_type_id ?? null
  const modality = data.modality ?? null
  if ((scanTypeId === null) === (modality === null)) {
    throw ValidationError.withField('scan_type_id', 'Choose either one scan type or a whole modality.')
  }
  const body = req.body()
  const hasBodyAnswers = Object.hasOwn(body, 'attention_answers')
  let raw = hasBodyAnswers ? body.attention_answers : (data.attention_answers ?? [])
  if (!hasBodyAnswers && !['yes_no', 'yes_no_unsure'].includes(data.answer_type)) raw = []
  const answers = parseAttentionAnswers(raw, String(data.answer_type))
  return {
    scan_type_id: scanTypeId,
    modality,
    code: data.code,
    question: data.question,
    help_text: data.help_text ?? null,
    answer_type: data.answer_type,
    is_required: Boolean(data.is_required ?? true),
    attention_answers: `{${answers.join(',')}}`,
    sort_order: Number(data.sort_order ?? 0),
    is_active: Boolean(data.is_active ?? true),
  }
}

export const checklistIndex = async (req, app) => {
  const validated = await app.validate(req, { scan_type_id: 'nullable|uuid', modality: `nullable|in:${MODALITIES}` })
  const items = await app.models.adminRepository.checklistItems(withoutNulls(validated))
  return ok({ items: items.map(presentItem) })
}

export const checklistStore = async (req, app) => {
  const data = checklistPayload(req, await app.validate(req, checklistRules()))
  const row = await runWrite(() => app.models.adminRepository.insertChecklistItem(data), ITEM_CONFLICT)
  await record(app, req, 'admin.checklist_item_created', 'checklist_item', String(row.id))
  return created(presentItem(row))
}

export const checklistUpdate = async (req, app) => {
  const id = uuidParam(req)
  const repository = app.models.adminRepository
  const existing = requireFound(await repository.checklistItem(id), 'Checklist item')
  const data = await app.validate(req, partial(req, checklistRules()))
  const payload = checklistPayload(req, mergeChecklist(req, existing, data))
  const updated = await runWrite(() => repository.updateChecklistItem(id, payload), ITEM_CONFLICT)
  const row = requireFound(updated, 'Checklist item')
  await record(app, req, 'admin.checklist_item_updated', 'checklist_item', id, { fields: Object.keys(data) })
  return ok(presentItem(row))
}

export const checklistDestroy = (req, app) =>
  deleteRecord(app, req, app.models.checklistItems, uuidParam(req), 'checklist_item', 'Checklist item')

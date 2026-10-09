import { useCallback, useMemo, useState } from 'react'
import { adminApi } from '../../api/admin'
import { CrudPage } from '../../components/admin/CrudPage'
import type { Column } from '../../components/admin/DataTable'
import type { FieldDef } from '../../components/admin/EntityForm'
import { adminRules } from '../../lib/adminValidation'
import { flag, int, nullable, str, text, type Values } from '../../lib/adminForm'
import { useApiQuery } from '../../hooks/useApi'
import type { FieldValidator } from '../../lib/validation'
import type { AdminCategory, AdminChecklistItem, AdminScanType } from '../../types/admin'

const MODALITY_OPTIONS = [
  { value: 'USG', label: 'Ultrasound (USG)' },
  { value: 'CT', label: 'CT' },
  { value: 'BIOPSY', label: 'Image-guided biopsy' },
]

const ANSWER_OPTIONS = [
  { value: 'yes_no', label: 'Yes or no' },
  { value: 'yes_no_unsure', label: 'Yes, no or not sure' },
  { value: 'text', label: 'Short text' },
  { value: 'date', label: 'Date' },
]

type Tab = 'types' | 'categories' | 'checklist'

const TABS: { id: Tab; label: string }[] = [
  { id: 'types', label: 'Scan types' },
  { id: 'categories', label: 'Categories' },
  { id: 'checklist', label: 'Checklist items' },
]

export default function CatalogPage() {
  const [tab, setTab] = useState<Tab>('types')
  return (
    <section aria-labelledby="catalog-heading">
      <h1 id="catalog-heading">Scans and checklists</h1>
      <div role="tablist" aria-label="Catalogue sections" className="tabs">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`panel-${item.id}`}
            className={`tabs__tab${tab === item.id ? ' tabs__tab--active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'types' ? <ScanTypesSection /> : null}
        {tab === 'categories' ? <CategoriesSection /> : null}
        {tab === 'checklist' ? <ChecklistSection /> : null}
      </div>
    </section>
  )
}

function useCategories() {
  const { data, reload } = useApiQuery(() => adminApi.categories(), [])
  return { categories: data?.categories ?? [], reload }
}

function ScanTypesSection() {
  const { categories } = useCategories()
  const [modality, setModality] = useState('')
  const [search, setSearch] = useState('')

  const load = useCallback(
    async (page: number) => {
      const response = await adminApi.scanTypes({ page, per_page: 20, modality, q: search })
      return { rows: response.scan_types, pagination: response.pagination }
    },
    [modality, search],
  )
  const columns = useMemo<Column<AdminScanType>[]>(
    () => [
      { key: 'name', header: 'Scan' },
      { key: 'modality', header: 'Modality' },
      { key: 'category_name', header: 'Category' },
      { key: 'duration_minutes', header: 'Minutes' },
      { key: 'is_active', header: 'Active' },
    ],
    [],
  )
  const fields = useMemo<FieldDef[]>(
    () => [
      { name: 'name', label: 'Scan name', required: true, minLength: 2, maxLength: 120 },
      { name: 'slug', label: 'Short name for links', required: true, maxLength: 80, validators: [adminRules.slug()] },
      { name: 'modality', label: 'Modality', kind: 'select', required: true, options: MODALITY_OPTIONS },
      { name: 'category_id', label: 'Category', kind: 'select', required: true, options: categories.map((category) => ({ value: category.id, label: `${category.name} (${category.modality})` })) },
      { name: 'short_description', label: 'Short description', kind: 'textarea', required: true, minLength: 5, maxLength: 600, rows: 3 },
      { name: 'preparation_tips', label: 'Preparation tips', kind: 'textarea', required: true, minLength: 5, maxLength: 2000, rows: 4 },
      { name: 'duration_minutes', label: 'Duration (minutes)', kind: 'number', required: true, min: 5, max: 240 },
      { name: 'fee_inr', label: 'Fee in rupees (optional)', hint: 'Leave blank until the doctor confirms fees. Fees are never shown on the website.', validators: [adminRules.amount()] },
      { name: 'sort_order', label: 'Display order', kind: 'number', min: 0, max: 1000 },
      { name: 'is_bookable_online', label: 'Patients can book this online', kind: 'checkbox' },
      { name: 'is_active', label: 'Shown on the website', kind: 'checkbox' },
    ],
    [categories],
  )
  const payload = (values: Values) => ({
    name: str(values, 'name'),
    slug: str(values, 'slug'),
    modality: str(values, 'modality'),
    category_id: str(values, 'category_id'),
    short_description: str(values, 'short_description'),
    preparation_tips: str(values, 'preparation_tips'),
    duration_minutes: int(values, 'duration_minutes', 20),
    fee_inr: nullable(values, 'fee_inr'),
    sort_order: int(values, 'sort_order'),
    is_bookable_online: flag(values, 'is_bookable_online'),
    is_active: flag(values, 'is_active'),
  })

  return (
    <CrudPage<AdminScanType>
      title="Scan types"
      entity="scan type"
      headingLevel={2}
      description="The scans patients can read about and book."
      columns={columns}
      fields={fields}
      load={load}
      deps={[categories.length]}
      rowName={(scan) => scan.name}
      toolbar={
        <div className="filters">
          <label>
            <span className="filters__label">Modality</span>
            <select value={modality} onChange={(event) => setModality(event.target.value)} className="field__input">
              <option value="">All</option>
              {MODALITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="filters__label">Search</span>
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} className="field__input" maxLength={80} placeholder="Scan name" />
          </label>
        </div>
      }
      toForm={(scan) => ({
        name: text(scan?.name),
        slug: text(scan?.slug),
        modality: scan?.modality ?? 'USG',
        category_id: scan?.category_id ?? categories.find((category) => category.modality === 'USG')?.id ?? '',
        short_description: text(scan?.short_description),
        preparation_tips: text(scan?.preparation_tips),
        duration_minutes: text(scan?.duration_minutes ?? 20),
        fee_inr: text(scan?.fee_inr),
        sort_order: text(scan?.sort_order ?? 0),
        is_bookable_online: scan?.is_bookable_online ?? true,
        is_active: scan?.is_active ?? true,
      })}
      create={(values) => adminApi.createScanType(payload(values))}
      update={(scan, values) => adminApi.updateScanType(scan.id, payload(values))}
      remove={(scan) => adminApi.deleteScanType(scan.id)}
    />
  )
}

function CategoriesSection() {
  const load = useCallback(async () => ({ rows: (await adminApi.categories()).categories }), [])
  const { categories } = useCategories()
  const columns = useMemo<Column<AdminCategory>[]>(
    () => [
      { key: 'name', header: 'Category' },
      { key: 'modality', header: 'Modality' },
      { key: 'parent_name', header: 'Group' },
      { key: 'is_active', header: 'Active' },
    ],
    [],
  )
  const fields = useCallback(
    (editing: AdminCategory | null): FieldDef[] => [
      { name: 'name', label: 'Category name', required: true, minLength: 2, maxLength: 120 },
      { name: 'slug', label: 'Short name for links', required: true, maxLength: 80, validators: [adminRules.slug()] },
      { name: 'modality', label: 'Modality', kind: 'select', required: true, options: MODALITY_OPTIONS },
      {
        name: 'parent_id',
        label: 'Part of group',
        kind: 'select',
        options: categories.filter((category) => category.id !== editing?.id).map((category) => ({ value: category.id, label: category.name })),
      },
      { name: 'tagline', label: 'Tagline', maxLength: 160 },
      { name: 'description', label: 'Description', kind: 'textarea', maxLength: 1000, rows: 3 },
      { name: 'sort_order', label: 'Display order', kind: 'number', min: 0, max: 1000 },
      { name: 'is_active', label: 'Shown on the website', kind: 'checkbox' },
    ],
    [categories],
  )
  const payload = (values: Values) => ({
    name: str(values, 'name'),
    slug: str(values, 'slug'),
    modality: str(values, 'modality'),
    parent_id: nullable(values, 'parent_id'),
    tagline: nullable(values, 'tagline'),
    description: nullable(values, 'description'),
    sort_order: int(values, 'sort_order'),
    is_active: flag(values, 'is_active'),
  })

  return (
    <CrudPage<AdminCategory>
      title="Categories"
      entity="category"
      headingLevel={2}
      description="Groups such as Obstetrics or Gynecology. A category that still has scans cannot be deleted."
      columns={columns}
      fields={fields}
      load={load}
      rowName={(category) => category.name}
      toForm={(category) => ({
        name: text(category?.name),
        slug: text(category?.slug),
        modality: category?.modality ?? 'USG',
        parent_id: text(category?.parent_id),
        tagline: text(category?.tagline),
        description: text(category?.description),
        sort_order: text(category?.sort_order ?? 0),
        is_active: category?.is_active ?? true,
      })}
      create={(values) => adminApi.createCategory(payload(values))}
      update={(category, values) => adminApi.updateCategory(category.id, payload(values))}
      remove={(category) => adminApi.deleteCategory(category.id)}
    />
  )
}

const exactlyOneScope: FieldValidator = (value, values) => {
  const hasScan = typeof value === 'string' && value !== ''
  const hasModality = typeof values.modality === 'string' && values.modality !== ''
  return hasScan === hasModality ? 'Choose either one scan or a whole modality.' : null
}

function ChecklistSection() {
  const [scanTypeId, setScanTypeId] = useState('')
  const [modality, setModality] = useState('')
  const { data: scans } = useApiQuery(() => adminApi.scanTypes({ per_page: 100 }), [])
  const scanOptions = useMemo(() => (scans?.scan_types ?? []).map((scan) => ({ value: scan.id, label: scan.name })), [scans])

  const load = useCallback(async () => ({ rows: (await adminApi.checklistItems({ scan_type_id: scanTypeId, modality })).items }), [scanTypeId, modality])
  const columns = useMemo<Column<AdminChecklistItem>[]>(
    () => [
      { key: 'question', header: 'Question' },
      { key: 'scope', header: 'Applies to', render: (item) => item.scan_type_name ?? `All ${item.modality ?? ''} scans` },
      { key: 'answer_type', header: 'Answer' },
      { key: 'is_required', header: 'Required' },
      { key: 'is_active', header: 'Active' },
    ],
    [],
  )
  const fields = useMemo<FieldDef[]>(
    () => [
      { name: 'question', label: 'Question', kind: 'textarea', required: true, minLength: 5, maxLength: 300, rows: 2 },
      { name: 'code', label: 'Code', required: true, maxLength: 80, hint: 'Lowercase letters, digits and underscores, for example ct_contrast_allergy.', validators: [adminRules.code()] },
      { name: 'help_text', label: 'Help text', kind: 'textarea', maxLength: 500, rows: 2 },
      { name: 'scan_type_id', label: 'Applies to one scan', kind: 'select', options: scanOptions, validators: [exactlyOneScope] },
      { name: 'modality', label: 'Or to every scan of a modality', kind: 'select', options: MODALITY_OPTIONS },
      { name: 'answer_type', label: 'Answer type', kind: 'select', required: true, options: ANSWER_OPTIONS },
      { name: 'attention_yes', label: 'Flag a "Yes" answer for staff attention', kind: 'checkbox' },
      { name: 'attention_no', label: 'Flag a "No" answer for staff attention', kind: 'checkbox' },
      { name: 'attention_unsure', label: 'Flag a "Not sure" answer for staff attention', kind: 'checkbox' },
      { name: 'sort_order', label: 'Display order', kind: 'number', min: 0, max: 1000 },
      { name: 'is_required', label: 'Patient must answer', kind: 'checkbox' },
      { name: 'is_active', label: 'In use', kind: 'checkbox' },
    ],
    [scanOptions],
  )
  const payload = (values: Values) => {
    const answerType = str(values, 'answer_type')
    const yesNo = answerType === 'yes_no' || answerType === 'yes_no_unsure'
    const attention = [flag(values, 'attention_yes') ? 'yes' : null, flag(values, 'attention_no') ? 'no' : null, answerType === 'yes_no_unsure' && flag(values, 'attention_unsure') ? 'unsure' : null]
    return {
      question: str(values, 'question'),
      code: str(values, 'code'),
      help_text: nullable(values, 'help_text'),
      scan_type_id: nullable(values, 'scan_type_id'),
      modality: nullable(values, 'modality'),
      answer_type: answerType,
      attention_answers: yesNo ? attention.filter((answer): answer is string => answer !== null) : [],
      sort_order: int(values, 'sort_order'),
      is_required: flag(values, 'is_required'),
      is_active: flag(values, 'is_active'),
    }
  }

  return (
    <CrudPage<AdminChecklistItem>
      title="Checklist items"
      entity="checklist item"
      headingLevel={2}
      description="Safety questions patients answer while booking. Items can apply to one scan or to every scan of a modality."
      columns={columns}
      fields={fields}
      load={load}
      rowName={(item) => item.code}
      toolbar={
        <div className="filters">
          <label>
            <span className="filters__label">Scan</span>
            <select value={scanTypeId} onChange={(event) => setScanTypeId(event.target.value)} className="field__input">
              <option value="">All scans</option>
              {scanOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="filters__label">Modality</span>
            <select value={modality} onChange={(event) => setModality(event.target.value)} className="field__input">
              <option value="">All</option>
              {MODALITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      }
      toForm={(item) => ({
        question: text(item?.question),
        code: text(item?.code),
        help_text: text(item?.help_text),
        scan_type_id: text(item?.scan_type_id),
        modality: text(item?.modality),
        answer_type: item?.answer_type ?? 'yes_no',
        attention_yes: item?.attention_answers.includes('yes') ?? false,
        attention_no: item?.attention_answers.includes('no') ?? false,
        attention_unsure: item?.attention_answers.includes('unsure') ?? false,
        sort_order: text(item?.sort_order ?? 0),
        is_required: item?.is_required ?? true,
        is_active: item?.is_active ?? true,
      })}
      create={(values) => adminApi.createChecklistItem(payload(values))}
      update={(item, values) => adminApi.updateChecklistItem(item.id, payload(values))}
      remove={(item) => adminApi.deleteChecklistItem(item.id)}
    />
  )
}

import { useCallback, useMemo } from 'react'
import { adminApi } from '../../api/admin'
import { CrudPage } from '../../components/admin/CrudPage'
import type { Column } from '../../components/admin/DataTable'
import type { FieldDef } from '../../components/admin/EntityForm'
import { flag, int, str, text, type Values } from '../../lib/adminForm'
import type { AdminFaq } from '../../types/admin'

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'booking', label: 'Booking' },
  { value: 'preparation', label: 'Preparation' },
  { value: 'reports', label: 'Reports' },
  { value: 'privacy', label: 'Privacy' },
]

const FIELDS: FieldDef[] = [
  { name: 'question', label: 'Question', required: true, minLength: 5, maxLength: 300 },
  { name: 'answer', label: 'Answer', kind: 'textarea', required: true, minLength: 5, maxLength: 2000, rows: 5 },
  { name: 'category', label: 'Category', kind: 'select', required: true, options: CATEGORY_OPTIONS },
  { name: 'sort_order', label: 'Display order', kind: 'number', min: 0, max: 1000 },
  { name: 'is_published', label: 'Published on the website', kind: 'checkbox' },
]

export function faqPayload(values: Values) {
  return {
    question: str(values, 'question'),
    answer: str(values, 'answer'),
    category: str(values, 'category'),
    sort_order: int(values, 'sort_order'),
    is_published: flag(values, 'is_published'),
  }
}

export default function FaqsPage() {
  const load = useCallback(async () => ({ rows: (await adminApi.faqs()).faqs }), [])
  const columns = useMemo<Column<AdminFaq>[]>(
    () => [
      { key: 'question', header: 'Question' },
      { key: 'category', header: 'Category' },
      { key: 'sort_order', header: 'Order' },
      { key: 'is_published', header: 'Published' },
    ],
    [],
  )
  return (
    <CrudPage<AdminFaq>
      title="FAQs"
      entity="FAQ"
      description="Frequently asked questions shown on the FAQ page and the home page. Never add anything about fetal sex."
      columns={columns}
      fields={FIELDS}
      load={load}
      rowName={(faq) => faq.question}
      toForm={(faq) => ({
        question: text(faq?.question),
        answer: text(faq?.answer),
        category: faq?.category ?? 'general',
        sort_order: text(faq?.sort_order ?? 0),
        is_published: faq?.is_published ?? true,
      })}
      create={(values) => adminApi.createFaq(faqPayload(values))}
      update={(faq, values) => adminApi.updateFaq(faq.id, faqPayload(values))}
      remove={(faq) => adminApi.deleteFaq(faq.id)}
    />
  )
}

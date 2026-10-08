import { useMemo, useState } from 'react'
import { CtaBand, PageHero } from '../../components/public/Blocks'
import { FaqAccordion } from '../../components/public/FaqAccordion'
import { AsyncState, FilterChips } from '../../components/public/Primitives'
import { usePublicResource } from '../../hooks/usePublicResource'
import { usePageMeta } from '../../lib/seo'

type Category = 'all' | 'booking' | 'preparation' | 'general' | 'reports' | 'privacy'

const OPTIONS: { value: Category; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'booking', label: 'Booking' },
  { value: 'preparation', label: 'Preparation' },
  { value: 'general', label: 'General' },
  { value: 'reports', label: 'Reports' },
  { value: 'privacy', label: 'Privacy' },
]

export default function FaqPage() {
  usePageMeta('FAQ', 'Answers to common questions about booking, preparing for scans, reports and privacy at Meghnad Diagnostic Centre.')
  const { data, status, error, reload } = usePublicResource('faqs')
  const [category, setCategory] = useState<Category>('all')
  const visible = useMemo(() => (data?.faqs ?? []).filter((faq) => category === 'all' || faq.category === category), [data, category])

  return (
    <>
      <PageHero eyebrow="FAQ" title="Frequently asked questions" intro="Quick answers about booking, preparation, reports and privacy." />
      <section className="section section--flush">
        <div className="container container--narrow">
          <FilterChips label="Filter questions by topic" options={OPTIONS} value={category} onChange={setCategory} />
          <AsyncState status={status} error={error} onRetry={reload} label="Loading questions">
            {visible.length === 0 ? <p className="state-card">No questions in this topic yet.</p> : <FaqAccordion key={category} faqs={visible} />}
          </AsyncState>
        </div>
      </section>
      <CtaBand title="Still have a question?" text="Contact the centre and we will be happy to help." />
    </>
  )
}

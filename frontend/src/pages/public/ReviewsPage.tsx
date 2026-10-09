import { PageHero } from '../../components/public/Blocks'
import { ReviewsPanel } from '../../components/public/ReviewsPanel'
import { usePageMeta } from '../../lib/seo'

export default function ReviewsPage() {
  usePageMeta('Reviews', 'Reviews of Meghnad Diagnostic Centre from patients, with a link to all reviews on Google.')
  return (
    <>
      <PageHero eyebrow="Reviews" title="What patients say on Google" intro="Only reviews that have been checked by our team are shown. Patients with a completed visit will be able to write a review from their portal." />
      <section className="section section--flush">
        <div className="container">
          <ReviewsPanel layout="list" />
        </div>
      </section>
    </>
  )
}

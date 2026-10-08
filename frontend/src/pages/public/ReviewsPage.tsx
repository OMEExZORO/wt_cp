import { PageHero } from '../../components/public/Blocks'
import { ReviewsPanel } from '../../components/public/ReviewsPanel'
import { usePageMeta } from '../../lib/seo'

export default function ReviewsPage() {
  usePageMeta('Reviews', 'Approved patient reviews of Meghnad Diagnostic Centre, with the average rating and review count.')
  return (
    <>
      <PageHero eyebrow="Reviews" title="Patient reviews" intro="Only reviews that have been checked by our team are shown. Patients with a completed visit will be able to write a review from their portal." />
      <section className="section section--flush">
        <div className="container">
          <ReviewsPanel layout="list" />
        </div>
      </section>
    </>
  )
}

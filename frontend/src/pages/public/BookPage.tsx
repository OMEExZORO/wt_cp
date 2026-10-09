import { Link, useSearchParams } from 'react-router-dom'
import { useAppSelector } from '../../app/hooks'
import { CalendarIcon, CheckIcon } from '../../components/icons/Icons'
import { PageHero } from '../../components/public/Blocks'
import { selectUser } from '../../features/auth/authSlice'
import { MODALITY_OPTIONS, buildBookQuery, readBookPrefill } from '../../lib/prefill'
import { usePageMeta } from '../../lib/seo'

const STEPS = [
  'Sign in, or create a free patient account.',
  'Choose a branch, a scan, a date and an available time.',
  'Answer a short safety checklist for your scan and give your consent.',
  'Receive your confirmation and preparation reminders.',
]

export const BOOKING_PATH = '/portal/patient/book'

export default function BookPage() {
  usePageMeta('Book an Appointment', 'Book a scan at Meghnad Diagnostic Centre. Sign in, choose a branch, scan and time, and complete a short safety checklist.')
  const user = useAppSelector(selectUser)
  const [params] = useSearchParams()
  const prefill = readBookPrefill(params)
  const centre = useAppSelector((state) => state.public.branches.data?.branches.find((branch) => branch.slug === prefill.branch))
  const modalityLabel = MODALITY_OPTIONS.find((option) => option.value === prefill.modality)?.label
  const bookingSearch = buildBookQuery({ branch: prefill.branch ?? '', modality: prefill.modality ?? '' })
  const accountSearch = buildBookQuery({ name: prefill.name ?? '', phone: prefill.phone ?? '' })
  const hasRequest = prefill.name !== null || prefill.phone !== null || modalityLabel !== undefined || centre !== undefined

  return (
    <>
      <PageHero eyebrow="Book an appointment" title="Book your scan online" intro="Booking is done inside the secure patient portal, so you need to be signed in." />
      <section className="section section--flush">
        <div className="container container--narrow">
          {hasRequest ? (
            <dl className="request-summary" aria-label="Your appointment request">
              {centre ? (
                <div>
                  <dt>Centre</dt>
                  <dd>{centre.name}</dd>
                </div>
              ) : null}
              {modalityLabel ? (
                <div>
                  <dt>Scan type</dt>
                  <dd>{modalityLabel}</dd>
                </div>
              ) : null}
              {prefill.name ? (
                <div>
                  <dt>Name</dt>
                  <dd>{prefill.name}</dd>
                </div>
              ) : null}
              {prefill.phone ? (
                <div>
                  <dt>Mobile</dt>
                  <dd>{prefill.phone}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          <ol className="steps">
            {STEPS.map((step) => (
              <li key={step}>
                <span className="steps__tick">
                  <CheckIcon size={18} />
                </span>
                {step}
              </li>
            ))}
          </ol>
          <div className="detail-actions">
            <Link to={bookingSearch === '' ? BOOKING_PATH : `${BOOKING_PATH}?${bookingSearch}`} className="btn btn--primary btn--lg">
              <CalendarIcon size={20} /> {user === null ? 'Continue to sign in and book' : 'Continue to booking'}
            </Link>
            {user === null ? (
              <Link to={accountSearch === '' ? '/register' : `/register?${accountSearch}`} className="text-link">
                New here? Create an account
              </Link>
            ) : null}
          </div>
          <p className="callout callout--plain">
            This service is not for emergencies. In an emergency, call 112 or go to the nearest hospital. Prenatal sex determination is prohibited under the PCPNDT Act.
          </p>
        </div>
      </section>
    </>
  )
}

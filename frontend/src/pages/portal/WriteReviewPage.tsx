import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { reviewsApi } from '../../api/admin'
import { useAppSelector } from '../../app/hooks'
import { EntityForm, type FieldDef } from '../../components/admin/EntityForm'
import { FormAlert } from '../../components/form/FormAlert'
import { PageLoader } from '../../components/PageLoader'
import { selectUser } from '../../features/auth/authSlice'
import { useApiQuery } from '../../hooks/useApi'
import { str } from '../../lib/adminForm'
import { formatDate } from '../../lib/format'
import { rules } from '../../lib/validation'
import type { EligibleAppointment, MyReview } from '../../types/admin'
import '../../styles/admin.css'

const RATING_OPTIONS = [
  { value: '5', label: '5 - Excellent' },
  { value: '4', label: '4 - Good' },
  { value: '3', label: '3 - Average' },
  { value: '2', label: '2 - Poor' },
  { value: '1', label: '1 - Very poor' },
]

const STATUS_TEXT: Record<MyReview['status'], string> = {
  pending: 'Waiting for approval',
  approved: 'Published',
  rejected: 'Not published',
}

export function defaultDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return 'Patient'
  }
  if (parts.length === 1) {
    return parts[0]
  }
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`
}

export function reviewFields(visits: EligibleAppointment[]): FieldDef[] {
  return [
    {
      name: 'appointment_id',
      label: 'Which visit?',
      kind: 'select',
      required: true,
      options: visits.map((visit) => ({ value: visit.id, label: `${visit.scan_name}, ${formatDate(visit.slot_date)} (${visit.reference_code})` })),
    },
    { name: 'rating', label: 'Rating', kind: 'select', required: true, options: RATING_OPTIONS },
    { name: 'body', label: 'Your review', kind: 'textarea', required: true, minLength: 10, maxLength: 1000, rows: 5, hint: 'Please do not include medical details, phone numbers or other personal information.' },
    { name: 'display_name', label: 'Name shown with your review', hint: 'Your first name and last initial are used by default.', maxLength: 80, minLength: 2, validators: [rules.name()] },
    { name: 'consent', label: 'I agree that this review and the name above may be published on the website after approval.', kind: 'checkbox', validators: [rules.accepted()] },
  ]
}

export default function WriteReviewPage() {
  const user = useAppSelector(selectUser)
  const load = useCallback(() => reviewsApi.mine(), [])
  const { data, error, loading, reload } = useApiQuery(load, [load])
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <section aria-labelledby="review-heading" className="review-page">
      <h1 id="review-heading">Write a review</h1>
      {error !== null ? <FormAlert>{error.message}</FormAlert> : null}
      {loading && data === null ? <PageLoader /> : null}
      {notice !== null ? <FormAlert tone="success">{notice}</FormAlert> : null}
      {data !== null ? (
        <>
          {data.eligible_appointments.length > 0 ? (
            <div className="card">
              <h2>Share your experience</h2>
              <EntityForm
                key={data.eligible_appointments.map((visit) => visit.id).join(',')}
                fields={reviewFields(data.eligible_appointments)}
                initialValues={{
                  appointment_id: data.eligible_appointments[0].id,
                  rating: '5',
                  body: '',
                  display_name: defaultDisplayName(user?.full_name ?? ''),
                  consent: false,
                }}
                submitLabel="Submit review"
                onSubmit={async (values) => {
                  await reviewsApi.submit({
                    appointment_id: str(values, 'appointment_id'),
                    rating: Number(str(values, 'rating')),
                    body: str(values, 'body'),
                    display_name: str(values, 'display_name') || null,
                    consent: values.consent === true,
                  })
                  setNotice('Thank you. Your review was received and will appear on the website once our team has approved it.')
                  await reload()
                }}
              />
            </div>
          ) : (
            <div className="card">
              <p>You can write a review once you have a completed visit. Reviews are checked by our team before they appear on the website.</p>
              <p>
                <Link to="/portal/patient">Back to your dashboard</Link>
              </p>
            </div>
          )}
          {data.reviews.length > 0 ? (
            <div className="card">
              <h2>Your reviews</h2>
              <ul className="plain-list">
                {data.reviews.map((review) => (
                  <li key={review.id}>
                    <span aria-label={`${review.rating} out of 5 stars`} className="stars">
                      {'★'.repeat(review.rating)}
                      {'☆'.repeat(5 - review.rating)}
                    </span>{' '}
                    <strong>{STATUS_TEXT[review.status]}</strong>
                    <p>{review.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

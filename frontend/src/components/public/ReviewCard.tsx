import { useState } from 'react'
import { relativeAge } from '../../lib/format'
import type { PublicReview } from '../../types/public'
import { Dialog } from '../Dialog'
import { GoogleGIcon } from '../icons/Icons'
import { StarRating } from './Primitives'

export const READ_MORE_THRESHOLD = 140

function Avatar({ name, photo }: { name: string; photo: string | null | undefined }) {
  const [failed, setFailed] = useState(false)
  const initial = (name.trim().charAt(0) || '?').toUpperCase()
  if (photo && !failed) {
    return <img className="review-avatar review-avatar--photo" src={photo} alt="" width={44} height={44} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
  }
  return (
    <span className="review-avatar" aria-hidden="true">
      {initial}
    </span>
  )
}

function CardBody({ review, clamp, onReadMore }: { review: PublicReview; clamp: boolean; onReadMore?: () => void }) {
  const google = review.source === 'google'
  const dateValue = review.external_review_date ?? review.created_at
  const age = relativeAge(dateValue)
  const long = review.body.length > READ_MORE_THRESHOLD
  return (
    <>
      <header className="review-card__head">
        <Avatar name={review.display_name} photo={review.reviewer_photo_url} />
        <div className="review-card__who">
          <p className="review-card__name">{review.display_name}</p>
          {age !== '' && dateValue ? (
            <p className="review-card__date">
              <time dateTime={dateValue}>{age}</time>
            </p>
          ) : null}
        </div>
        {google ? (
          <span className="review-card__badge" title="Posted on Google">
            <GoogleGIcon size={22} />
            <span className="visually-hidden">Google</span>
          </span>
        ) : null}
      </header>
      <StarRating rating={review.rating} size={18} />
      <p className={`review-card__body${clamp && long ? ' review-card__body--clamped' : ''}`}>{review.body}</p>
      {clamp && long && onReadMore ? (
        <button type="button" className="review-card__more" onClick={onReadMore} aria-label={`Read more of the review by ${review.display_name}`}>
          Read more
        </button>
      ) : null}
      <footer className="review-card__foot">
        {google ? (
          review.source_url ? (
            <a href={review.source_url} target="_blank" rel="noopener noreferrer" className="review-card__source">
              Posted on Google
            </a>
          ) : (
            <span className="review-card__source">Posted on Google</span>
          )
        ) : null}
        {review.translated_by_google ? <span className="review-card__note">Translated by Google</span> : null}
        {review.verified_visit ? <span className="carousel__verified">Verified visit</span> : null}
      </footer>
    </>
  )
}

export function ReviewCard({ review }: { review: PublicReview }) {
  const [open, setOpen] = useState(false)
  return (
    <article className="review-card review-card--google" aria-label={`Review by ${review.display_name}`}>
      <CardBody review={review} clamp onReadMore={() => setOpen(true)} />
      {open ? (
        <Dialog
          title={`Review by ${review.display_name}`}
          onClose={() => setOpen(false)}
          footer={
            <button type="button" className="btn btn--outline" onClick={() => setOpen(false)}>
              Close
            </button>
          }
        >
          <div className="review-card review-card--dialog">
            <CardBody review={review} clamp={false} />
          </div>
        </Dialog>
      ) : null}
    </article>
  )
}

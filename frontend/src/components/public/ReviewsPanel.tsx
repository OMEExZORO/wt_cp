import { useAppSelector } from '../../app/hooks'
import { usePublicResource } from '../../hooks/usePublicResource'
import { selectSetting } from '../../features/public/publicSlice'
import { settingText } from '../../lib/contact'
import { ExternalIcon } from '../icons/Icons'
import { AsyncState, StarRating, Todo } from './Primitives'
import { ReviewCard } from './ReviewCard'
import { ReviewsCarousel } from './ReviewsCarousel'

export function GoogleReviewsButton({ variant = 'primary', label = 'Review us on Google' }: { variant?: 'primary' | 'outline'; label?: string }) {
  const entry = useAppSelector(selectSetting('links.google_reviews_url'))
  const url = settingText(entry)
  if (url === null) {
    return <Todo label="Google reviews link" />
  }
  return (
    <a className={`btn btn--${variant}`} href={url} target="_blank" rel="noopener noreferrer">
      {label} <ExternalIcon size={16} />
    </a>
  )
}

export function GoogleRating() {
  const rating = Number(settingText(useAppSelector(selectSetting('google.rating'))))
  const count = Number(settingText(useAppSelector(selectSetting('google.review_count'))))
  if (!Number.isFinite(rating) || rating <= 0 || rating > 5 || !Number.isFinite(count) || count <= 0) {
    return null
  }
  return (
    <div className="google-rating">
      <p className="google-rating__label">Rated on Google</p>
      <p className="google-rating__score" aria-label={`Google rating ${rating.toFixed(1)} out of 5 from ${count} reviews`}>
        {rating.toFixed(1)}
      </p>
      <StarRating rating={rating} size={22} />
      <p className="google-rating__count">from {count} Google reviews</p>
    </div>
  )
}

export function ReviewsPanel({ layout }: { layout: 'carousel' | 'list' }) {
  const { data, status, error, reload } = usePublicResource('reviews')
  usePublicResource('site')

  return (
    <AsyncState status={status} error={error} onRetry={reload} label="Loading reviews">
      {data !== null && data.reviews.length > 0 ? (
        <div className="reviews">
          <div className="reviews__summary">
            <GoogleRating />
            <GoogleReviewsButton variant="outline" label="See all reviews on Google" />
          </div>
          {layout === 'carousel' ? (
            <ReviewsCarousel reviews={data.reviews} label="Patient reviews from Google" />
          ) : (
            <ul className="review-grid">
              {data.reviews.map((review) => (
                <li key={review.id}>
                  <ReviewCard review={review} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="empty-reviews">
          <h3 className="empty-reviews__title">Be the first to share your experience</h3>
          <p>Reviews appear here after they have been checked by our team. Nothing on this page is made up.</p>
          <GoogleReviewsButton />
        </div>
      )}
    </AsyncState>
  )
}

import { useAppSelector } from '../../app/hooks'
import { usePublicResource } from '../../hooks/usePublicResource'
import { selectSetting } from '../../features/public/publicSlice'
import { settingText } from '../../lib/contact'
import { ExternalIcon } from '../icons/Icons'
import { AsyncState, StarRating, Todo } from './Primitives'
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

export function ReviewsPanel({ layout }: { layout: 'carousel' | 'list' }) {
  const { data, status, error, reload } = usePublicResource('reviews')
  usePublicResource('site')

  return (
    <AsyncState status={status} error={error} onRetry={reload} label="Loading reviews">
      {data !== null && data.summary.count > 0 ? (
        <div className="reviews">
          <div className="reviews__summary">
            <p className="reviews__score" aria-label={`Average rating ${data.summary.average_rating} out of 5`}>
              {data.summary.average_rating?.toFixed(1)}
            </p>
            <StarRating rating={data.summary.average_rating ?? 0} size={24} />
            <p className="reviews__count">
              {data.summary.count} approved {data.summary.count === 1 ? 'review' : 'reviews'}
            </p>
            <GoogleReviewsButton variant="outline" label="See more on Google" />
          </div>
          {layout === 'carousel' ? (
            <ReviewsCarousel reviews={data.reviews} />
          ) : (
            <ul className="review-list">
              {data.reviews.map((review) => (
                <li key={review.id} className="review-card">
                  <StarRating rating={review.rating} />
                  <p className="review-card__body">{review.body}</p>
                  <p className="review-card__author">
                    {review.display_name}
                    {review.verified_visit ? <span className="carousel__verified">Verified visit</span> : null}
                  </p>
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

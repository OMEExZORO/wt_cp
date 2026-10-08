import { useCallback, useEffect, useRef, useState } from 'react'
import type { PublicReview } from '../../types/public'
import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from '../icons/Icons'
import { StarRating } from './Primitives'

const INTERVAL_MS = 7000

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function ReviewsCarousel({ reviews }: { reviews: PublicReview[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(() => prefersReducedMotion())
  const [hovering, setHovering] = useState(false)
  const [focusWithin, setFocusWithin] = useState(false)
  const timer = useRef<number | null>(null)
  const total = reviews.length

  const go = useCallback(
    (delta: number) => {
      setIndex((current) => (current + delta + total) % total)
    },
    [total],
  )

  const running = !paused && !hovering && !focusWithin && total > 1

  useEffect(() => {
    if (!running) {
      return undefined
    }
    timer.current = window.setInterval(() => go(1), INTERVAL_MS)
    return () => {
      if (timer.current !== null) {
        window.clearInterval(timer.current)
      }
    }
  }, [running, go])

  if (total === 0) {
    return null
  }
  const review = reviews[Math.min(index, total - 1)]

  return (
    <section
      className="carousel"
      aria-roledescription="carousel"
      aria-label="Patient reviews"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={() => setFocusWithin(false)}
    >
      <div className="carousel__slide" role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${total}`} aria-live={running ? 'off' : 'polite'}>
        <StarRating rating={review.rating} size={22} />
        <blockquote className="carousel__quote">{review.body}</blockquote>
        <p className="carousel__author">
          {review.display_name}
          {review.verified_visit ? <span className="carousel__verified">Verified visit</span> : null}
        </p>
      </div>
      {total > 1 ? (
        <div className="carousel__controls">
          <button type="button" className="icon-btn" onClick={() => go(-1)} aria-label="Previous review">
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setPaused((value) => !value)}
            aria-label={paused ? 'Start automatic rotation' : 'Pause automatic rotation'}
          >
            {paused ? <PlayIcon /> : <PauseIcon />}
          </button>
          <button type="button" className="icon-btn" onClick={() => go(1)} aria-label="Next review">
            <ChevronRightIcon />
          </button>
          <span className="carousel__count" aria-hidden="true">
            {index + 1} / {total}
          </span>
        </div>
      ) : null}
    </section>
  )
}

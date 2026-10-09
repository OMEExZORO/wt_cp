import { useCallback, useEffect, useState } from 'react'
import { prefersReducedMotion } from '../../lib/motion'
import type { PublicReview } from '../../types/public'
import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from '../icons/Icons'
import { ReviewCard } from './ReviewCard'

const INTERVAL_MS = 6000
const DESKTOP_QUERY = '(min-width: 900px)'

function useCardsPerView(): number {
  const read = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(DESKTOP_QUERY).matches ? 3 : 1)
  const [count, setCount] = useState(read)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return undefined
    }
    const query = window.matchMedia(DESKTOP_QUERY)
    const update = () => setCount(query.matches ? 3 : 1)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return count
}

export function ReviewsCarousel({ reviews, label = 'Patient reviews' }: { reviews: PublicReview[]; label?: string }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(() => prefersReducedMotion())
  const [hovering, setHovering] = useState(false)
  const [focusWithin, setFocusWithin] = useState(false)
  const perView = Math.min(useCardsPerView(), reviews.length)
  const total = reviews.length
  const rotates = total > perView
  const running = !paused && !hovering && !focusWithin && rotates

  const go = useCallback(
    (delta: number) => {
      setIndex((current) => (current + delta + total) % total)
    },
    [total],
  )

  useEffect(() => {
    if (!running) {
      return undefined
    }
    const timer = window.setInterval(() => go(1), INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [running, go])

  if (total === 0) {
    return null
  }
  const visible = Array.from({ length: perView }, (_, offset) => reviews[(index + offset) % total])

  return (
    <section
      className="review-carousel"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocusWithin(false)
        }
      }}
    >
      <ul className="review-carousel__track" aria-live={running ? 'off' : 'polite'} data-per-view={perView}>
        {visible.map((review) => (
          <li key={review.id} className="review-carousel__item" aria-roledescription="slide">
            <ReviewCard review={review} />
          </li>
        ))}
      </ul>
      {rotates ? (
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

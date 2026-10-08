import type { ReactNode } from 'react'
import { StarIcon } from '../icons/Icons'

export function Todo({ label }: { label?: string }) {
  if (!import.meta.env.DEV) {
    return null
  }
  return (
    <span className="todo-badge" data-testid="todo-badge">
      TODO: add real value{label ? ` (${label})` : ''}
    </span>
  )
}

interface SectionHeadingProps {
  eyebrow?: string
  title: string
  intro?: string
  id?: string
  align?: 'left' | 'center'
  as?: 'h1' | 'h2'
}

export function SectionHeading({ eyebrow, title, intro, id, align = 'left', as: Tag = 'h2' }: SectionHeadingProps) {
  return (
    <header className={`section-heading section-heading--${align}`}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <Tag id={id} className="section-heading__title">
        {title}
      </Tag>
      {intro ? <p className="section-heading__intro">{intro}</p> : null}
    </header>
  )
}

export function StarRating({ rating, size = 18 }: { rating: number; size?: number }) {
  const rounded = Math.round(rating)
  return (
    <span className="stars" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon key={n} size={size} className={n <= rounded ? 'stars__on' : 'stars__off'} fill={n <= rounded ? 'currentColor' : 'none'} />
      ))}
    </span>
  )
}

interface AsyncStateProps {
  status: 'idle' | 'loading' | 'succeeded' | 'failed'
  error: string | null
  onRetry: () => void
  children: ReactNode
  label?: string
}

export function AsyncState({ status, error, onRetry, children, label = 'Loading' }: AsyncStateProps) {
  if (status === 'failed') {
    return (
      <div className="state-card state-card--error" role="alert">
        <p>{error ?? 'Something went wrong.'}</p>
        <button type="button" className="btn btn--outline" onClick={onRetry}>
          Try again
        </button>
      </div>
    )
  }
  if (status !== 'succeeded') {
    return (
      <div className="state-card" role="status" aria-live="polite">
        <span className="page-loader__spinner" aria-hidden="true" />
        <span>{label}…</span>
      </div>
    )
  }
  return <>{children}</>
}

export function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (next: T) => void
}) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`chip${value === option.value ? ' chip--active' : ''}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

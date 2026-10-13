import { useCallback, useEffect, useId, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { siteImage, type ImageKey } from '../../lib/images'
import { prefersReducedMotion } from '../../lib/motion'
import { CalendarIcon } from '../icons/Icons'

export interface HeroSlide {
  id: string
  image: ImageKey
  eyebrow: string
  title: string
  text: string
  bookQuery?: string
}

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'welcome',
    image: 'hero-welcome',
    eyebrow: 'Meghnad Diagnostic Centre, Bhosari, Pune',
    title: 'Imaging for a Healthier Tomorrow',
    text: 'Complete diagnostic care under one roof, led by Dr. Meghnad Padsalgikar (MBBS, DMRE, DNB Radiology).',
  },
  {
    id: 'ultrasound',
    image: 'hero-ultrasound',
    eyebrow: 'Ultrasound',
    title: 'Safe, non-invasive and highly accurate ultrasound',
    text: 'Obstetric, gynaecology, abdominal, small parts, Doppler and prostate imaging.',
    bookQuery: 'modality=USG',
  },
  {
    id: 'ct',
    image: 'hero-ct',
    eyebrow: 'CT scan',
    title: 'Detailed, fast and low-dose CT scanning',
    text: 'From CT brain and HRCT chest to abdomen, spine and CT-guided procedures.',
    bookQuery: 'modality=CT',
  },
  {
    id: 'biopsy',
    image: 'hero-biopsy',
    eyebrow: 'Image-guided biopsy',
    title: 'Precise, safe and minimally invasive biopsies',
    text: 'Ultrasound and CT guided FNAC, core biopsies, drainage and aspiration.',
    bookQuery: 'modality=BIOPSY',
  },
]

const INTERVAL_MS = 6500

export function HeroCarousel({ slides = HERO_SLIDES }: { slides?: HeroSlide[] }) {
  const [index, setIndex] = useState(0)
  const [hovering, setHovering] = useState(false)
  const [focusWithin, setFocusWithin] = useState(false)
  const headingId = useId()
  const total = slides.length
  const paused = prefersReducedMotion()
  const running = !paused && !hovering && !focusWithin && total > 1

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

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      go(1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      go(-1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      setIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setIndex(total - 1)
    }
  }

  return (
    <section
      className="hero-carousel"
      aria-roledescription="carousel"
      aria-label="Our imaging services"
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocusWithin(false)
        }
      }}
    >
      <div className="hero-carousel__viewport" aria-live={running ? 'off' : 'polite'}>
        {slides.map((slide, position) => {
          const image = siteImage(slide.image)
          const active = position === index
          const bookTo = slide.bookQuery ? `/book?${slide.bookQuery}` : '/book'
          const Heading = position === 0 ? 'h1' : 'h2'
          return (
            <div
              key={slide.id}
              className={`hero-slide${active ? ' hero-slide--active' : ''}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${position + 1} of ${total}`}
              aria-hidden={active ? undefined : true}
            >
              <img
                className="hero-slide__image"
                src={image.src}
                alt=""
                width={image.width}
                height={image.height}
                loading={position === 0 ? 'eager' : 'lazy'}
                decoding={position === 0 ? 'sync' : 'async'}
                {...(position === 0 ? ({ fetchpriority: 'high' } as Record<string, string>) : {})}
              />
              <div className="hero-slide__shade" />
              <div className="container hero-slide__content">
                <div className="hero-slide__copy">
                  <p className="eyebrow eyebrow--light">{slide.eyebrow}</p>
                  <Heading id={position === 0 ? headingId : undefined} className="hero-slide__title">
                    {slide.title}
                  </Heading>
                  <p className="hero-slide__text">{slide.text}</p>
                  <div className="hero-slide__actions">
                    <Link to={bookTo} className="btn btn--primary btn--lg" tabIndex={active ? 0 : -1}>
                      <CalendarIcon size={20} /> Book Appointment
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="container hero-carousel__bar" aria-hidden="true">
        <div className="hero-carousel__dots">
          {slides.map((slide, position) => (
            <span key={slide.id} className={`hero-carousel__dot${position === index ? ' hero-carousel__dot--active' : ''}`} />
          ))}
        </div>
      </div>
    </section>
  )
}

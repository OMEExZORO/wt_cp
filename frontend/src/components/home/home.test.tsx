import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { setupStore } from '../../app/store'
import { mockApi, renderApp } from '../../test/utils'
import { relativeAge } from '../../lib/format'
import { buildBookQuery, readBookPrefill } from '../../lib/prefill'
import type { PublicReview } from '../../types/public'
import { ReviewCard } from '../public/ReviewCard'
import { ReviewsCarousel } from '../public/ReviewsCarousel'
import { HeroCarousel } from './HeroCarousel'

function renderHero() {
  return render(
    <Provider store={setupStore()}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <HeroCarousel />
      </MemoryRouter>
    </Provider>,
  )
}

function slideTitle(): string | null {
  const active = document.querySelector('.hero-slide--active .hero-slide__title')
  return active?.textContent ?? null
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('HeroCarousel', () => {
  it('shows one slide per modality plus a welcome slide with the booking call to action', () => {
    renderHero()
    expect(document.querySelectorAll('.hero-slide')).toHaveLength(4)
    expect(slideTitle()).toBe('Imaging for a Healthier Tomorrow')
    expect(screen.getByRole('link', { name: /Book Appointment/ })).toHaveAttribute('href', '/book')
    expect(screen.getByRole('region', { name: 'Our imaging services' })).toHaveAttribute('aria-roledescription', 'carousel')
  })

  it('loads only the first hero image eagerly', () => {
    renderHero()
    const images = Array.from(document.querySelectorAll('.hero-slide__image'))
    expect(images.map((image) => image.getAttribute('loading'))).toEqual(['eager', 'lazy', 'lazy', 'lazy'])
  })

  it('moves with the previous and next buttons and the dots', async () => {
    const user = userEvent.setup()
    renderHero()
    await user.click(screen.getByRole('button', { name: 'Next slide' }))
    expect(slideTitle()).toContain('ultrasound')
    await user.click(screen.getByRole('button', { name: 'Previous slide' }))
    expect(slideTitle()).toBe('Imaging for a Healthier Tomorrow')
    await user.click(screen.getByRole('button', { name: /Go to slide 3/ }))
    expect(slideTitle()).toContain('CT')
  })

  it('supports arrow keys, Home and End', async () => {
    const user = userEvent.setup()
    renderHero()
    screen.getByRole('button', { name: 'Next slide' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(slideTitle()).toContain('ultrasound')
    await user.keyboard('{ArrowLeft}')
    expect(slideTitle()).toBe('Imaging for a Healthier Tomorrow')
    await user.keyboard('{End}')
    expect(slideTitle()).toContain('biopsies')
    await user.keyboard('{Home}')
    expect(slideTitle()).toBe('Imaging for a Healthier Tomorrow')
  })

  it('rotates automatically and the pause button stops it', async () => {
    vi.useFakeTimers()
    renderHero()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6600)
    })
    expect(slideTitle()).toContain('ultrasound')
    await act(async () => {
      screen.getByRole('button', { name: 'Pause automatic slide show' }).click()
    })
    expect(screen.getByRole('button', { name: 'Start automatic slide show' })).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000)
    })
    expect(slideTitle()).toContain('ultrasound')
  })

  it('starts paused when the visitor prefers reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }))
    renderHero()
    expect(screen.getByRole('button', { name: 'Start automatic slide show' })).toBeInTheDocument()
  })
})

const google: PublicReview = {
  id: 'g1',
  display_name: 'Asha Kumar',
  rating: 5,
  body: 'The staff were calm and explained every step of the scan clearly. The report was ready quickly and the doctor answered all our questions patiently.',
  verified_visit: false,
  created_at: '2026-10-01T10:00:00+05:30',
  source: 'google',
  source_url: 'https://share.google/example',
  external_review_date: '2026-08-01',
  reviewer_photo_url: null,
}

describe('ReviewCard', () => {
  it('shows name, initial avatar, stars, age, Google badge and source', () => {
    render(<ReviewCard review={google} />)
    const card = screen.getByRole('article', { name: 'Review by Asha Kumar' })
    expect(within(card).getByText('Asha Kumar')).toBeInTheDocument()
    expect(within(card).getByText('A')).toBeInTheDocument()
    expect(within(card).getByRole('img', { name: '5 out of 5 stars' })).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: 'Posted on Google' })).toHaveAttribute('href', 'https://share.google/example')
    expect(within(card).getByText('Google')).toBeInTheDocument()
    expect(card.querySelector('time')).toHaveAttribute('datetime', '2026-08-01')
  })

  it('opens the full text in an accessible dialog from Read more', async () => {
    const user = userEvent.setup()
    render(<ReviewCard review={google} />)
    await user.click(screen.getByRole('button', { name: /Read more of the review by Asha Kumar/ }))
    const dialog = screen.getByRole('dialog', { name: 'Review by Asha Kumar' })
    expect(within(dialog).getByText(google.body)).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('has no Read more for short text and no Google label for site reviews', () => {
    render(<ReviewCard review={{ ...google, body: 'Good service', source: 'site', source_url: null }} />)
    expect(screen.queryByRole('button', { name: /Read more/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Posted on Google')).not.toBeInTheDocument()
  })

  it('shows the Translated by Google note', () => {
    render(<ReviewCard review={{ ...google, translated_by_google: true }} />)
    expect(screen.getByText('Translated by Google')).toBeInTheDocument()
  })
})

describe('ReviewsCarousel', () => {
  const many = Array.from({ length: 4 }, (_, i) => ({ ...google, id: `g${i}`, display_name: `Reviewer ${i}`, body: `Review text number ${i} is here.` }))

  it('rotates on a timer, pauses on request and wraps around', async () => {
    vi.useFakeTimers()
    render(<ReviewsCarousel reviews={many} />)
    expect(screen.getByText('Reviewer 0')).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6100)
    })
    expect(screen.getByText('Reviewer 1')).toBeInTheDocument()
    await act(async () => {
      screen.getByRole('button', { name: 'Pause automatic rotation' }).click()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000)
    })
    expect(screen.getByText('Reviewer 1')).toBeInTheDocument()
    await act(async () => {
      screen.getByRole('button', { name: 'Previous review' }).click()
    })
    await act(async () => {
      screen.getByRole('button', { name: 'Previous review' }).click()
    })
    expect(screen.getByText('Reviewer 3')).toBeInTheDocument()
  })
})

describe('relativeAge', () => {
  const now = new Date('2026-10-09T00:00:00Z')
  it('describes ages from a date', () => {
    expect(relativeAge('2026-09-09', now)).toBe('a month ago')
    expect(relativeAge('2026-01-09', now)).toBe('9 months ago')
    expect(relativeAge('2025-10-09', now)).toBe('a year ago')
    expect(relativeAge('2022-10-09', now)).toBe('4 years ago')
    expect(relativeAge(null, now)).toBe('')
  })
})

describe('booking prefill helpers', () => {
  it('builds and reads query parameters, ignoring invalid values', () => {
    const query = buildBookQuery({ branch: 'bhosari', name: 'Asha Kumar', phone: '9876543210', modality: 'CT' })
    expect(readBookPrefill(new URLSearchParams(query))).toEqual({ branch: 'bhosari', name: 'Asha Kumar', phone: '9876543210', modality: 'CT' })
    expect(readBookPrefill(new URLSearchParams('name=<script>&phone=123&modality=XYZ&branch=A B'))).toEqual({ branch: null, name: null, phone: null, modality: null })
  })
})

describe('Home page', () => {
  it('requests an appointment and continues to /book with the values prefilled', async () => {
    const branch = {
      id: 'b1',
      slug: 'bhosari',
      name: 'MDC Bhosari',
      address_line: 'Nagdev Tower',
      landmark: null,
      area: 'Bhosari',
      city: 'Pune',
      state: 'Maharashtra',
      postal_code: '411039',
      phone: null,
      whatsapp: null,
      email: null,
      opening_hours: null,
      maps_url: null,
      maps_embed_url: null,
      latitude: null,
      longitude: null,
      address_is_placeholder: false,
      is_placeholder: false,
    }
    mockApi((path) => (path.startsWith('/public/branches') ? { status: 200, body: { branches: [branch] } } : undefined))
    const user = userEvent.setup()
    renderApp('/')
    await screen.findByRole('option', { name: 'MDC Bhosari' })
    await user.type(screen.getByLabelText(/Full name/), 'Asha Kumar')
    await user.type(screen.getByLabelText(/Mobile number/), '9876543210')
    await user.selectOptions(screen.getByLabelText(/Scan type/), 'CT')
    await user.click(screen.getByRole('button', { name: /Continue to booking/ }))
    expect(await screen.findByRole('heading', { name: 'Book your scan online' })).toBeInTheDocument()
    const summary = screen.getByLabelText('Your appointment request')
    expect(within(summary).getByText('Asha Kumar')).toBeInTheDocument()
    expect(within(summary).getByText('CT scan')).toBeInTheDocument()
  })

  it('shows errors and stays on the page when the request is incomplete', async () => {
    mockApi(() => undefined)
    const user = userEvent.setup()
    renderApp('/')
    await user.click(await screen.findByRole('button', { name: /Continue to booking/ }))
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
    expect(screen.queryByRole('heading', { name: 'Book your scan online' })).not.toBeInTheDocument()
  })
})

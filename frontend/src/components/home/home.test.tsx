import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { setupStore } from '../../app/store'
import { mockApi, renderApp } from '../../test/utils'
import { relativeAge } from '../../lib/format'
import { buildBookQuery, readBookPrefill } from '../../lib/prefill'
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

  it('draws every hero slide as decorative inline artwork', () => {
    renderHero()
    const art = Array.from(document.querySelectorAll('svg.hero-slide__image'))
    expect(art).toHaveLength(4)
    art.forEach((node) => expect(node).toHaveAttribute('aria-hidden', 'true'))
    expect(document.querySelectorAll('.hero-slide img')).toHaveLength(0)
  })

  it('has no manual slide buttons and a single booking button', () => {
    renderHero()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('link', { name: /Call Now/ })).toBeNull()
  })

  it('supports arrow keys, Home and End', async () => {
    const user = userEvent.setup()
    renderHero()
    screen.getAllByRole('link', { name: /Book Appointment/ })[0].focus()
    await user.keyboard('{ArrowRight}')
    expect(slideTitle()).toContain('ultrasound')
    await user.keyboard('{ArrowLeft}')
    expect(slideTitle()).toBe('Imaging for a Healthier Tomorrow')
    await user.keyboard('{End}')
    expect(slideTitle()).toContain('biopsies')
    await user.keyboard('{Home}')
    expect(slideTitle()).toBe('Imaging for a Healthier Tomorrow')
  })

  it('rotates automatically through the slides', async () => {
    vi.useFakeTimers()
    renderHero()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6600)
    })
    expect(slideTitle()).toContain('ultrasound')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6600)
    })
    expect(slideTitle()).toContain('CT')
  })

  it('starts paused when the visitor prefers reduced motion', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }))
    renderHero()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000)
    })
    expect(slideTitle()).toBe('Imaging for a Healthier Tomorrow')
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
      address_line: 'Nagdeo Towers, Ground & Second Floor, Pune-Nashik Road, Bhosari, Pune',
      landmark: null,
      area: 'Bhosari',
      city: 'Pune',
      state: 'Maharashtra',
      postal_code: '411039',
      phone: null,
      phone_secondary: null,
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

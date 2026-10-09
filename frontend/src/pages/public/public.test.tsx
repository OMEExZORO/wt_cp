import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderApp } from '../../test/utils'
import type { PublicBranch, PublicFaq, PublicScanType, SettingsMap } from '../../types/public'
import { filterScans, groupScans } from './ServicesPage'

const scans: PublicScanType[] = [
  {
    id: '1',
    slug: 'dating-scan',
    modality: 'USG',
    name: 'Dating Scan',
    short_description: 'Estimates the due date.',
    preparation_tips: 'Drink water.',
    is_bookable_online: true,
    category: { slug: 'usg-obstetrics', name: 'Obstetrics' },
    group: { slug: 'ultrasound', name: 'Ultrasound (USG)' },
  },
  {
    id: '2',
    slug: 'ct-brain',
    modality: 'CT',
    name: 'CT Brain',
    short_description: 'A CT scan of the head.',
    preparation_tips: 'Remove metal items.',
    is_bookable_online: true,
    category: { slug: 'ct', name: 'Computed Tomography (CT)' },
    group: null,
  },
  {
    id: '3',
    slug: 'fnac',
    modality: 'BIOPSY',
    name: 'FNAC',
    short_description: 'A needle sample taken under ultrasound.',
    preparation_tips: 'Tell staff about blood thinners.',
    is_bookable_online: true,
    category: { slug: 'biopsy-usg-guided', name: 'USG Guided' },
    group: { slug: 'image-guided-biopsies', name: 'Image-Guided Biopsies' },
  },
]

const branch: PublicBranch = {
  id: 'b1',
  slug: 'bhosari',
  name: 'MDC Bhosari',
  address_line: 'Nagdev Tower, Pune Nashik Road',
  landmark: 'Near Vishwavilas Hotel and Shraddha Jewellers',
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
  is_placeholder: true,
}

const faqs: PublicFaq[] = [
  { id: 'f1', question: 'How do I book?', answer: 'Use the booking page.', category: 'booking', sort_order: 1 },
  { id: 'f2', question: 'Is ultrasound safe?', answer: 'It uses sound waves.', category: 'general', sort_order: 2 },
]

const placeholderSettings: SettingsMap = {
  'links.google_reviews_url': { value: null, type: 'url', group: 'links', label: 'Google reviews', is_placeholder: true },
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function servicesApi() {
  return mockApi((path) => {
    if (path.startsWith('/public/scan-types')) {
      return { status: 200, body: { scan_types: scans } }
    }
    return undefined
  })
}

describe('scan filtering helpers', () => {
  it('filters by modality and search text', () => {
    expect(filterScans(scans, 'CT', '')).toHaveLength(1)
    expect(filterScans(scans, 'ALL', 'needle')).toHaveLength(1)
    expect(filterScans(scans, 'USG', 'brain')).toHaveLength(0)
  })

  it('groups scans under their top-level heading', () => {
    const sections = groupScans(scans)
    expect(sections.map((section) => section.title)).toEqual(['Ultrasound (USG)', 'Computed Tomography (CT)', 'Image-Guided Biopsies'])
    expect(sections[0].sub[0].title).toBe('Obstetrics')
  })
})

describe('Services page', () => {
  it('lists scans grouped by category and filters with the chips', async () => {
    servicesApi()
    renderApp('/services')
    expect(await screen.findByText('Dating Scan')).toBeInTheDocument()
    expect(screen.getByText('CT Brain')).toBeInTheDocument()
    expect(screen.getByText('FNAC')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'CT' }))
    expect(screen.getByRole('button', { name: 'CT' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Dating Scan')).not.toBeInTheDocument()
    expect(screen.getByText('CT Brain')).toBeInTheDocument()
  })

  it('narrows results with the controlled search box and shows an empty message', async () => {
    servicesApi()
    renderApp('/services')
    await screen.findByText('Dating Scan')
    const user = userEvent.setup()
    const search = screen.getByLabelText('Search scans')
    await user.type(search, 'brain')
    expect(search).toHaveValue('brain')
    expect(screen.queryByText('Dating Scan')).not.toBeInTheDocument()
    expect(screen.getByText('CT Brain')).toBeInTheDocument()
    await user.clear(search)
    await user.type(search, 'zzzz')
    expect(screen.getByText('No scans match your search.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear search and filters' }))
    expect(await screen.findByText('Dating Scan')).toBeInTheDocument()
  })

  it('shows an error state with a retry button when the API fails', async () => {
    mockApi((path) => (path.startsWith('/public/scan-types') ? { status: 500, body: { code: 'SERVER_ERROR', message: 'Server broke.' } } : undefined))
    renderApp('/services')
    expect(await screen.findByRole('alert')).toHaveTextContent('Server broke.')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

describe('Reviews page', () => {
  function reviewsApi(settings: SettingsMap) {
    return mockApi((path) => {
      if (path.startsWith('/public/reviews')) {
        return { status: 200, body: { reviews: [], summary: { count: 0, average_rating: null } } }
      }
      if (path === '/public/site') {
        return { status: 200, body: { settings } }
      }
      return undefined
    })
  }

  it('shows the empty state and a TODO badge in dev when the Google URL is a placeholder', async () => {
    reviewsApi(placeholderSettings)
    renderApp('/reviews')
    expect(await screen.findByText('Be the first to share your experience')).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByTestId('todo-badge').length).toBeGreaterThan(0))
  })

  it('hides the placeholder button in production', async () => {
    vi.stubEnv('DEV', false)
    reviewsApi(placeholderSettings)
    renderApp('/reviews')
    expect(await screen.findByText('Be the first to share your experience')).toBeInTheDocument()
    expect(screen.queryByTestId('todo-badge')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Review us on Google/ })).not.toBeInTheDocument()
  })

  it('links to the Google reviews page when the URL is set', async () => {
    reviewsApi({
      'links.google_reviews_url': { value: 'https://g.page/r/example/review', type: 'url', group: 'links', label: 'Google reviews', is_placeholder: false },
    })
    renderApp('/reviews')
    const link = await screen.findByRole('link', { name: /Review us on Google/ })
    expect(link).toHaveAttribute('href', 'https://g.page/r/example/review')
  })

  it('shows approved reviews without a computed average', async () => {
    mockApi((path) =>
      path.startsWith('/public/reviews')
        ? {
            status: 200,
            body: {
              reviews: [{ id: 'r1', display_name: 'Test Patient', rating: 5, body: 'Clear explanation and kind staff.', verified_visit: false, created_at: null }],
              summary: { count: 1, average_rating: 5 },
            },
          }
        : undefined,
    )
    renderApp('/reviews')
    expect(await screen.findByText('Clear explanation and kind staff.')).toBeInTheDocument()
    expect(screen.queryByText(/approved review/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Average rating/)).not.toBeInTheDocument()
    expect(screen.queryByText('Rated on Google')).not.toBeInTheDocument()
  })

  it('shows the Google rating from settings and a see-all link', async () => {
    mockApi((path) => {
      if (path.startsWith('/public/reviews')) {
        return {
          status: 200,
          body: { reviews: [{ id: 'r1', display_name: 'A B', rating: 5, body: 'Good service here.', verified_visit: false, created_at: null }], summary: { count: 1, average_rating: 5 } },
        }
      }
      if (path === '/public/site') {
        return {
          status: 200,
          body: {
            settings: {
              'google.rating': { value: '3.3', type: 'string', group: 'links', label: 'Rating', is_placeholder: false },
              'google.review_count': { value: '60', type: 'string', group: 'links', label: 'Count', is_placeholder: false },
              'links.google_reviews_url': { value: 'https://g.page/r/example/review', type: 'url', group: 'links', label: 'Google', is_placeholder: false },
            },
          },
        }
      }
      return undefined
    })
    renderApp('/reviews')
    expect(await screen.findByText('Rated on Google')).toBeInTheDocument()
    expect(screen.getByLabelText('Google rating 3.3 out of 5 from 60 reviews')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /See all reviews on Google/ })).toHaveAttribute('href', 'https://g.page/r/example/review')
  })
})

describe('Branches page', () => {
  it('embeds a map built from the address and offers directions', async () => {
    mockApi((path) => (path.startsWith('/public/branches') ? { status: 200, body: { branches: [branch] } } : undefined))
    renderApp('/branches')
    const frame = await screen.findByTitle('Map showing MDC Bhosari')
    expect(frame.getAttribute('src')).toContain('https://www.google.com/maps?q=')
    expect(frame.getAttribute('src')).toContain('output=embed')
    expect(frame.getAttribute('src')).toContain(encodeURIComponent('Nagdev Tower'))
    expect(screen.getByRole('link', { name: /Get directions/ })).toHaveAttribute('href', expect.stringContaining('destination='))
  })
})

describe('FAQ page', () => {
  it('opens and closes answers and supports arrow-key navigation', async () => {
    mockApi((path) => (path.startsWith('/public/faqs') ? { status: 200, body: { faqs } } : undefined))
    renderApp('/faq')
    const first = await screen.findByRole('button', { name: 'How do I book?' })
    expect(first).toHaveAttribute('aria-expanded', 'false')
    const user = userEvent.setup()
    await user.click(first)
    expect(first).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Use the booking page.')).toBeVisible()
    first.focus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('button', { name: 'Is ultrasound safe?' })).toHaveFocus()
    await user.click(first)
    expect(first).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('Footer and legal copy', () => {
  it('keeps the PCPNDT notice on every public page', async () => {
    mockApi(() => undefined)
    renderApp('/privacy')
    const footer = await screen.findByRole('contentinfo')
    expect(within(footer).getByText('Prenatal sex determination is prohibited under the PCPNDT Act.')).toBeInTheDocument()
    expect(await screen.findByText(/Pending doctor and legal review/)).toBeInTheDocument()
  })
})

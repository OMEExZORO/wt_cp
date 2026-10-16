import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderApp } from '../../test/utils'
import type { PublicBranch, PublicFaq, PublicScanType } from '../../types/public'
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

const OFFICIAL_HOURS = 'Monday to Saturday: 8:00 AM to 10:00 PM\nSunday: Closed\nLab service: open 24 hours'

const officialBranch = (id: string, slug: string, name: string, area: string, address_line: string, postal_code: string, phone: string, phone_secondary: string): PublicBranch => ({
  id,
  slug,
  name,
  address_line,
  landmark: null,
  area,
  city: 'Pune',
  state: 'Maharashtra',
  postal_code,
  phone,
  phone_secondary,
  whatsapp: null,
  email: null,
  opening_hours: OFFICIAL_HOURS,
  maps_url: null,
  maps_embed_url: null,
  latitude: null,
  longitude: null,
  address_is_placeholder: false,
  is_placeholder: false,
})

const branches4: PublicBranch[] = [
  officialBranch('b1', 'bhosari', 'MDC Bhosari', 'Bhosari', 'Nagdeo Towers, Ground & Second Floor, Pune-Nashik Road, Bhosari, Pune', '411039', '9890094569', '8308849804'),
  officialBranch('b2', 'moshi', 'MDC Moshi', 'Moshi', 'Gat No. 284, Near Shree Hospital, Dehu-Moshi Road, Tal. Haveli, Dist. Pune', '411070', '8380068696', '8308849804'),
  officialBranch('b3', 'pimple-gurav', 'MDC Pimple Gurav', 'Pimple Gurav', 'Patil Plaza Shop No. 3, Opp. PCMC School, Sangvi-Pimple Gurav Road, Pimple Gurav, Pune', '411061', '8380068693', '9689891846'),
  officialBranch('b4', 'moi', 'MDC Moi', 'Moi', 'At. Moi, Gat No. 652, Moi - Nighoje Road, Tal. Khed, Dist. Pune', '410501', '8669604865', '8308849804'),
]

const faqs: PublicFaq[] = [
  { id: 'f1', question: 'How do I book?', answer: 'Use the booking page.', category: 'booking', sort_order: 1 },
  { id: 'f2', question: 'Is ultrasound safe?', answer: 'It uses sound waves.', category: 'general', sort_order: 2 },
]

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

describe('Branches page', () => {
  it('lists all four branches with both phone numbers and a Google Maps search link', async () => {
    mockApi((path) => (path.startsWith('/public/branches') ? { status: 200, body: { branches: branches4 } } : undefined))
    renderApp('/branches')
    expect(await screen.findByRole('heading', { name: 'MDC Pimple Gurav' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(
      expect.arrayContaining(['MDC Bhosari', 'MDC Moshi', 'MDC Pimple Gurav', 'MDC Moi']),
    )
    expect(screen.getAllByText('24 Hours Lab Service').length).toBeGreaterThanOrEqual(4)
    expect(screen.getAllByText('Nagdeo Towers, Ground & Second Floor, Pune-Nashik Road, Bhosari, Pune - 411 039')[0]).toBeInTheDocument()
    expect(screen.getAllByText('At. Moi, Gat No. 652, Moi - Nighoje Road, Tal. Khed, Dist. Pune - 410 501')[0]).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: '+91 83088 49804' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: '+91 98900 94569' })[0]).toHaveAttribute('href', 'tel:+919890094569')
    expect(screen.getAllByRole('link', { name: '+91 96898 91846' })[0]).toHaveAttribute('href', 'tel:+919689891846')
    expect(screen.getAllByRole('link', { name: /View on Google Maps/ })).toHaveLength(4)
    expect(screen.queryByTitle(/Map showing/)).not.toBeInTheDocument()
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
    expect(await screen.findByRole('heading', { name: 'How long we keep it' })).toBeInTheDocument()
    expect(screen.queryByText(/Pending doctor and legal review/)).not.toBeInTheDocument()
  })
})

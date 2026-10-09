import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { todayIso } from '../../lib/booking'
import { makeUser, mockApi, renderApp } from '../../test/utils'
import type { Appointment, Slot } from '../../types/booking'

afterEach(() => {
  vi.unstubAllGlobals()
})

const BRANCH = {
  id: 'b1',
  slug: 'bhosari',
  name: 'MDC Bhosari',
  address_line: 'Main Road',
  landmark: null,
  area: 'Area',
  city: 'Pune',
  state: 'Maharashtra',
  postal_code: null,
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

const SCAN = {
  id: 's1',
  slug: 'dating-scan',
  modality: 'USG',
  name: 'Dating Scan',
  short_description: 'A scan.',
  preparation_tips: 'Drink water.',
  is_bookable_online: false,
  category: { slug: 'usg', name: 'Ultrasound' },
  group: null,
}

const CHECKLIST = {
  scan_type: { id: 's1', name: 'Dating Scan', slug: 'dating-scan', modality: 'USG', preparation_tips: 'Drink water.', is_bookable_online: false },
  items: [{ id: 'c1', code: 'bladder', question: 'Full bladder?', help_text: null, answer_type: 'yes_no', is_required: true }],
}

const slot = (id: string, start: string, remaining: number, date = todayIso()): Slot => ({
  id,
  branch_id: 'b1',
  modality: 'USG',
  date,
  start_time: start,
  end_time: '23:59',
  starts_at: `${date}T${start}:00+05:30`,
  capacity: 2,
  booked_count: 2 - remaining,
  remaining,
  is_blocked: false,
  is_available: remaining > 0,
  status: remaining > 0 ? 'ok' : 'full',
})

function appointment(overrides: Partial<Appointment> = {}): Appointment {
  const date = todayIso()
  return {
    id: 'a1',
    reference_code: 'MDC-TEST01',
    status: 'confirmed',
    urgency: 'Routine',
    starts_at: `${date}T10:00:00+05:30`,
    ends_at: `${date}T10:30:00+05:30`,
    slot: { id: 'sl1', date, start_time: '10:00', end_time: '10:30' },
    branch: { id: 'b1', name: 'MDC Bhosari', slug: 'bhosari', address: 'MDC Bhosari, Main Road', phone: null, maps_url: null },
    scan_type: { id: 's1', name: 'Dating Scan', slug: 'dating-scan', modality: 'USG', preparation_tips: 'Drink water.' },
    patient: { id: 'p1', full_name: 'Asha Kulkarni', phone: '9876543210', email: null },
    patient_notes: null,
    needs_attention: false,
    attention_count: 0,
    booked_by_staff: true,
    created_at: null,
    rescheduled_at: null,
    checked_in_at: null,
    completed_at: null,
    cancelled_at: null,
    cancellation_reason: null,
    can_cancel: true,
    can_reschedule: true,
    calendar: { ics_path: '/appointments/a1/ics', google_url: null },
    ...overrides,
  }
}

type Extra = (path: string, init: RequestInit) => { status: number; body: unknown } | undefined

function handler(extra: Extra) {
  return (path: string, init: RequestInit) => {
    const custom = extra(path, init)
    if (custom !== undefined) {
      return custom
    }
    if (path === '/public/branches') {
      return { status: 200, body: { branches: [BRANCH] } }
    }
    if (path.startsWith('/public/scan-types')) {
      return { status: 200, body: { scan_types: [SCAN] } }
    }
    if (path.startsWith('/scan-types/') && path.endsWith('/checklist')) {
      return { status: 200, body: CHECKLIST }
    }
    if (path.startsWith('/booking/days')) {
      return { status: 200, body: { from: todayIso(), to: todayIso(), days: [{ date: todayIso(), slot_count: 2, remaining: 3 }] } }
    }
    if (path.startsWith('/booking/availability')) {
      const slots = [slot('sl1', '10:00', 2), slot('sl2', '11:00', 2)]
      return {
        status: 200,
        body: {
          date: todayIso(),
          branch: { id: 'b1', name: 'MDC Bhosari', slug: 'bhosari' },
          scan_type: { id: 's1', name: 'Dating Scan', modality: 'USG' },
          slots,
          summary: { total: 2, available: 2, branch_full: false, no_sessions: false },
          suggestion: null,
        },
      }
    }
    return undefined
  }
}

describe('reception cancel and reschedule', () => {
  it('cancels an appointment with a reason from the reception row', async () => {
    const user = userEvent.setup()
    let current = appointment()
    const cancels: unknown[] = []
    mockApi(
      handler((path, init) => {
        if (path.startsWith('/appointments?')) {
          return { status: 200, body: { appointments: [current] } }
        }
        if (path === '/appointments/a1/cancel' && init.method === 'PATCH') {
          cancels.push(JSON.parse(String(init.body)))
          current = appointment({ status: 'cancelled', can_cancel: false, can_reschedule: false })
          return { status: 200, body: { appointment: current } }
        }
        return undefined
      }),
      makeUser('receptionist'),
    )
    renderApp('/portal/reception')

    await user.click(await screen.findByRole('button', { name: 'Cancel Asha Kulkarni' }))
    const dialog = await screen.findByRole('dialog', { name: 'Cancel this appointment?' })
    await user.type(within(dialog).getByLabelText(/reason/i), 'Patient called to cancel')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel appointment' }))

    await waitFor(() => expect(cancels).toEqual([{ reason: 'Patient called to cancel' }]))
    expect(await screen.findByText('Cancelled')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel Asha Kulkarni' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reschedule Asha Kulkarni' })).not.toBeInTheDocument()
  })

  it('does not offer cancel or reschedule for a completed appointment', async () => {
    mockApi(
      handler((path) => (path.startsWith('/appointments?') ? { status: 200, body: { appointments: [appointment({ status: 'completed', can_cancel: false, can_reschedule: false })] } } : undefined)),
      makeUser('receptionist'),
    )
    renderApp('/portal/reception')
    await screen.findByRole('heading', { level: 3, name: 'Asha Kulkarni' })
    expect(screen.queryByRole('button', { name: /^Cancel / })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Reschedule / })).not.toBeInTheDocument()
  })

  it('reschedules to a new slot and shows the new time', async () => {
    const user = userEvent.setup()
    let current = appointment()
    const patches: unknown[] = []
    mockApi(
      handler((path, init) => {
        if (path.startsWith('/appointments?')) {
          return { status: 200, body: { appointments: [current] } }
        }
        if (path === '/appointments/a1/reschedule' && init.method === 'PATCH') {
          patches.push(JSON.parse(String(init.body)))
          current = appointment({ slot: { id: 'sl2', date: todayIso(), start_time: '11:00', end_time: '11:30' } })
          return { status: 200, body: { appointment: current } }
        }
        return undefined
      }),
      makeUser('receptionist'),
    )
    renderApp('/portal/reception')

    await user.click(await screen.findByRole('button', { name: 'Reschedule Asha Kulkarni' }))
    const dialog = await screen.findByRole('dialog', { name: 'Reschedule appointment' })
    const confirm = within(dialog).getByRole('button', { name: 'Confirm new time' })
    expect(confirm).toBeDisabled()
    await user.click(await within(dialog).findByRole('button', { name: /left/ }))
    await user.click(await within(dialog).findByRole('radio', { name: /11:00 am/ }))
    expect(confirm).toBeEnabled()
    await user.click(confirm)

    await waitFor(() => expect(patches).toEqual([{ slot_id: 'sl2' }]))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText(/11:00/)).toBeInTheDocument()
  })
})

describe('walk-in booking', () => {
  it('is reachable from the reception dashboard', async () => {
    const user = userEvent.setup()
    mockApi(handler((path) => (path.startsWith('/appointments?') ? { status: 200, body: { appointments: [] } } : undefined)), makeUser('receptionist'))
    renderApp('/portal/reception')
    await user.click(await screen.findByRole('link', { name: 'New walk-in booking' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'New walk-in booking' })).toBeInTheDocument()
  })

  it('blocks patients from the walk-in page', async () => {
    mockApi(handler(() => undefined), makeUser('patient'))
    renderApp('/portal/reception/walk-in')
    await waitFor(() => expect(screen.queryByRole('heading', { level: 1, name: 'New walk-in booking' })).not.toBeInTheDocument())
  })

  it('keeps the book button disabled until patient, scan, slot, checklist and consent are complete, then books for a new patient', async () => {
    const user = userEvent.setup()
    const posts: Record<string, unknown>[] = []
    mockApi(
      handler((path, init) => {
        if (path === '/appointments' && init.method === 'POST') {
          posts.push(JSON.parse(String(init.body)))
          return { status: 201, body: { appointment: appointment(), email_sent: false } }
        }
        return undefined
      }),
      makeUser('receptionist'),
    )
    renderApp('/portal/reception/walk-in')

    const book = await screen.findByRole('button', { name: 'Book walk-in' })
    expect(book).toBeDisabled()

    await user.type(screen.getByLabelText(/Patient full name/), 'Asha Kulkarni')
    await user.type(screen.getByLabelText(/Mobile number/), '98765')
    expect(await screen.findByText(/valid 10 digit/i)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/Mobile number/), '43210')

    await user.selectOptions(screen.getByLabelText(/^Branch/), 'b1')
    await user.selectOptions(screen.getByLabelText(/^Scan/), 's1')
    expect(book).toBeDisabled()
    await user.click(await screen.findByRole('button', { name: /left/ }))
    await user.click(await screen.findByRole('radio', { name: /10:00 am/ }))
    await user.click(await screen.findByRole('radio', { name: 'Yes' }))
    expect(book).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: /agreed in person/ }))
    expect(book).toBeEnabled()
    await user.click(book)

    expect(await screen.findByRole('heading', { level: 1, name: 'Walk-in booked' })).toBeInTheDocument()
    expect(posts).toHaveLength(1)
    expect(posts[0]).toMatchObject({
      scan_type_id: 's1',
      slot_id: 'sl1',
      consent: true,
      urgency: 'Routine',
      patient_full_name: 'Asha Kulkarni',
      patient_phone: '9876543210',
      answers: { c1: 'yes' },
    })
    expect(posts[0]).not.toHaveProperty('patient_id')
    expect(screen.getByText('MDC-TEST01')).toBeInTheDocument()
  })

  it('looks up an existing patient and books with their id', async () => {
    const user = userEvent.setup()
    const posts: Record<string, unknown>[] = []
    mockApi(
      handler((path, init) => {
        if (path.startsWith('/patients/lookup')) {
          return { status: 200, body: { patients: [{ id: 'p9', full_name: 'Ravi Joshi', phone: '9123456780' }] } }
        }
        if (path === '/appointments' && init.method === 'POST') {
          posts.push(JSON.parse(String(init.body)))
          return { status: 201, body: { appointment: appointment({ patient: { id: 'p9', full_name: 'Ravi Joshi', phone: '9123456780', email: null } }) } }
        }
        return undefined
      }),
      makeUser('receptionist'),
    )
    renderApp('/portal/reception/walk-in')

    await user.click(await screen.findByRole('radio', { name: 'Existing patient' }))
    await user.type(screen.getByLabelText(/Find by name or mobile number/), 'ravi')
    await user.click(screen.getByRole('button', { name: 'Search patients' }))
    await user.click(await screen.findByRole('radio', { name: /Ravi Joshi/ }))

    await user.selectOptions(screen.getByLabelText(/^Branch/), 'b1')
    await user.selectOptions(screen.getByLabelText(/^Scan/), 's1')
    await user.click(await screen.findByRole('button', { name: /left/ }))
    await user.click(await screen.findByRole('radio', { name: /10:00 am/ }))
    await user.click(await screen.findByRole('radio', { name: 'Yes' }))
    await user.click(screen.getByRole('checkbox', { name: /agreed in person/ }))
    await user.click(screen.getByRole('button', { name: 'Book walk-in' }))

    await screen.findByRole('heading', { level: 1, name: 'Walk-in booked' })
    expect(posts[0]).toMatchObject({ patient_id: 'p9' })
    expect(posts[0]).not.toHaveProperty('patient_full_name')
  })

  it('rejects a search that is too short without calling the server', async () => {
    const user = userEvent.setup()
    const fetchMock = mockApi(handler(() => undefined), makeUser('receptionist'))
    renderApp('/portal/reception/walk-in')
    await user.click(await screen.findByRole('radio', { name: 'Existing patient' }))
    await user.type(screen.getByLabelText(/Find by name or mobile number/), 'ab')
    await user.click(screen.getByRole('button', { name: 'Search patients' }))
    expect(await screen.findByText(/at least 3 characters/)).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/patients/lookup'))).toBe(false)
  })

  it('refuses script and SQL payloads in the patient name and writes nothing', async () => {
    const user = userEvent.setup()
    const fetchMock = mockApi(handler(() => undefined), makeUser('receptionist'))
    renderApp('/portal/reception/walk-in')
    const book = await screen.findByRole('button', { name: 'Book walk-in' })
    await user.type(screen.getByLabelText(/Patient full name/), '<script>alert(1)</script>')
    expect(await screen.findByText(/letters|not allowed|unsafe|invalid/i)).toBeInTheDocument()
    await user.clear(screen.getByLabelText(/Patient full name/))
    await user.type(screen.getByLabelText(/Patient full name/), "' OR '1'='1")
    expect(book).toBeDisabled()
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'POST' && String(init?.body).includes('script'))).toBe(false)
  })
})

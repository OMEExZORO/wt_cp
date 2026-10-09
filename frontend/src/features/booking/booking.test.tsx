import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeUser, mockApi, renderApp } from '../../test/utils'
import { todayIso } from '../../lib/booking'
import type { Appointment, Slot, SlotSuggestion } from '../../types/booking'
import type { PublicBranch, PublicScanType } from '../../types/public'
import { filterBookableScans } from './BookingWizard'

afterEach(() => {
  vi.unstubAllGlobals()
})

const branch = (id: string, name: string): PublicBranch => ({
  id,
  slug: name.toLowerCase(),
  name,
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
})

const BRANCHES = [branch('b1', 'MDC Bhosari'), branch('b2', 'MDC Nigdi')]

const scan = (id: string, name: string, bookable = true): PublicScanType => ({
  id,
  slug: name.toLowerCase().replace(/ /g, '-'),
  modality: 'USG',
  name,
  short_description: 'A scan.',
  preparation_tips: 'Drink water.',
  is_bookable_online: bookable,
  category: { slug: 'usg', name: 'Ultrasound' },
  group: null,
})

const SCANS = [scan('s1', 'Dating Scan'), scan('s2', 'Neck Scan'), scan('s3', 'Phone Only Scan', false)]

const slot = (id: string, branchId: string, start: string, remaining: number, date = todayIso()): Slot => ({
  id,
  branch_id: branchId,
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
    patient: { id: 'p1', full_name: 'Asha Kulkarni', phone: '9876543210', email: 'asha@example.com' },
    patient_notes: null,
    needs_attention: false,
    attention_count: 0,
    booked_by_staff: false,
    created_at: null,
    rescheduled_at: null,
    checked_in_at: null,
    completed_at: null,
    cancelled_at: null,
    cancellation_reason: null,
    can_cancel: true,
    can_reschedule: true,
    calendar: { ics_path: '/appointments/a1/ics', google_url: 'https://calendar.google.com/calendar/render?action=TEMPLATE' },
    ...overrides,
  }
}

const CHECKLIST = {
  scan_type: { id: 's1', name: 'Dating Scan', slug: 'dating-scan', modality: 'USG', preparation_tips: 'Drink water before the scan.', is_bookable_online: true },
  items: [
    { id: 'c1', code: 'bladder', question: 'Will you come with a full bladder?', help_text: null, answer_type: 'yes_no', is_required: true },
    { id: 'c2', code: 'lmp', question: 'First day of your last period', help_text: null, answer_type: 'date', is_required: false },
  ],
}

function baseHandler(extra: (path: string, init: RequestInit) => { status: number; body: unknown } | undefined = () => undefined) {
  return (path: string, init: RequestInit) => {
    const custom = extra(path, init)
    if (custom !== undefined) {
      return custom
    }
    if (path === '/public/branches') {
      return { status: 200, body: { branches: BRANCHES } }
    }
    if (path.startsWith('/public/scan-types')) {
      return { status: 200, body: { scan_types: SCANS } }
    }
    if (path.startsWith('/scan-types/') && path.endsWith('/checklist')) {
      return { status: 200, body: CHECKLIST }
    }
    if (path.startsWith('/booking/days')) {
      return { status: 200, body: { from: todayIso(), to: todayIso(), days: [{ date: todayIso(), slot_count: 2, remaining: 3 }] } }
    }
    return undefined
  }
}

function availability(slots: Slot[], suggestion: SlotSuggestion | null = null) {
  const available = slots.filter((s) => s.is_available).length
  return {
    date: todayIso(),
    branch: { id: 'b1', name: 'MDC Bhosari', slug: 'bhosari' },
    scan_type: { id: 's1', name: 'Dating Scan', modality: 'USG' },
    slots,
    summary: { total: slots.length, available, branch_full: slots.length > 0 && available === 0, no_sessions: slots.length === 0 },
    suggestion,
  }
}

const stepHeading = (n: number) => screen.findByRole('heading', { level: 2, name: new RegExp(`^Step ${n} of 5`) })

describe('filterBookableScans', () => {
  it('hides scans that cannot be booked online and filters by text', () => {
    expect(filterBookableScans(SCANS, '').map((s) => s.name)).toEqual(['Dating Scan', 'Neck Scan'])
    expect(filterBookableScans(SCANS, 'neck').map((s) => s.name)).toEqual(['Neck Scan'])
  })
})

describe('booking wizard', () => {
  it('moves through the steps, keeps Next disabled until valid, and books only after consent', async () => {
    const user = userEvent.setup()
    const requests: { path: string; body: unknown }[] = []
    const slots = [slot('sl1', 'b1', '10:00', 2), slot('sl2', 'b1', '10:30', 0)]
    mockApi(
      baseHandler((path, init) => {
        if (path.startsWith('/booking/availability')) {
          return { status: 200, body: availability(slots) }
        }
        if (path === '/appointments' && init.method === 'POST') {
          requests.push({ path, body: JSON.parse(String(init.body)) })
          return { status: 201, body: { appointment: appointment(), email_sent: true } }
        }
        if (path === '/appointments/a1') {
          return { status: 200, body: { appointment: appointment() } }
        }
        return undefined
      }),
      makeUser('patient'),
    )
    renderApp('/portal/patient/book')

    expect(await stepHeading(1)).toBeInTheDocument()
    const next = screen.getByRole('button', { name: 'Next' })
    expect(next).toBeDisabled()
    await user.click(await screen.findByRole('radio', { name: /MDC Bhosari/ }))
    expect(next).toBeEnabled()
    await user.click(next)

    const step2 = await stepHeading(2)
    await waitFor(() => expect(step2).toHaveFocus())
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    expect(screen.queryByRole('radio', { name: /Phone Only Scan/ })).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Search scans'), 'dating')
    expect(screen.queryByRole('radio', { name: /Neck Scan/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /Dating Scan/ }))
    await user.click(screen.getByRole('button', { name: 'Next' }))

    await stepHeading(3)
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    await user.click(await screen.findByRole('button', { name: /left/ }))
    expect(await screen.findByText('1 of 2 times available')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /10:30 am/ })).toBeDisabled()
    await user.click(await screen.findByRole('radio', { name: /10:00 am/ }))
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Next' }))

    await stepHeading(4)
    expect(await screen.findByText(/Drink water before the scan/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: 'Yes' }))
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Next' }))

    await stepHeading(5)
    const book = screen.getByRole('button', { name: 'Book appointment' })
    expect(book).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: /I agree/ }))
    expect(book).toBeEnabled()
    await user.click(book)

    expect(await screen.findByRole('heading', { level: 1, name: 'Your appointment is booked' })).toBeInTheDocument()
    expect(requests).toHaveLength(1)
    expect(requests[0].body).toMatchObject({ scan_type_id: 's1', slot_id: 'sl1', consent: true, answers: { c1: 'yes' } })
    expect(screen.getByRole('link', { name: 'Download .ics file' })).toHaveAttribute('href', expect.stringContaining('/appointments/a1/ics'))
    expect(screen.getByRole('link', { name: 'Add to Google Calendar' })).toHaveAttribute('href', expect.stringContaining('calendar.google.com'))
  })

  it('shows the earliest slot at the other branch when the chosen branch is full and switches in one click', async () => {
    const user = userEvent.setup()
    const suggestion: SlotSuggestion = {
      kind: 'other_branch',
      branch: { id: 'b2', name: 'MDC Nigdi', slug: 'nigdi' },
      slot: slot('sl9', 'b2', '11:00', 2),
    }
    mockApi(
      baseHandler((path) => {
        if (path.startsWith('/booking/availability')) {
          const full = path.includes('branch_id=b1')
          return { status: 200, body: full ? availability([slot('sl1', 'b1', '10:00', 0)], suggestion) : availability([suggestion.slot]) }
        }
        return undefined
      }),
      makeUser('patient'),
    )
    renderApp('/portal/patient/book', {
      booking: {
        step: 2,
        draft: { branch_id: 'b1', scan_type_id: 's1', date: todayIso(), slot_id: null, urgency: 'Routine', checklist: {}, notes: '', consent: false },
      },
    })

    const banner = await screen.findByTestId('branch-full-suggestion')
    expect(within(banner).getByText('MDC Nigdi')).toBeInTheDocument()
    expect(screen.getByText(/fully booked/)).toBeInTheDocument()
    await user.click(within(banner).getByRole('button', { name: /Switch to MDC Nigdi/ }))

    await waitFor(() => expect(screen.getByRole('radio', { name: /11:00 am/ })).toBeChecked())
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  it('offers the suggestion again when the slot is taken between review and booking', async () => {
    const user = userEvent.setup()
    const suggestion: SlotSuggestion = {
      kind: 'other_branch',
      branch: { id: 'b2', name: 'MDC Nigdi', slug: 'nigdi' },
      slot: slot('sl9', 'b2', '11:00', 2),
    }
    mockApi(
      baseHandler((path, init) => {
        if (path.startsWith('/booking/availability')) {
          return { status: 200, body: availability([slot('sl1', 'b1', '10:00', 2)]) }
        }
        if (path === '/appointments' && init.method === 'POST') {
          return {
            status: 409,
            body: { code: 'CONFLICT', message: 'This time slot has just been fully booked. Please choose another time.', fields: { slot_id: 'taken' }, reason: 'SLOT_FULL', suggestion },
          }
        }
        return undefined
      }),
      makeUser('patient'),
    )
    renderApp('/portal/patient/book', {
      booking: {
        step: 2,
        draft: { branch_id: 'b1', scan_type_id: 's1', date: todayIso(), slot_id: 'sl1', urgency: 'Routine', checklist: { c1: 'yes' }, notes: '', consent: true },
      },
    })
    await user.click(await screen.findByRole('radio', { name: /10:00 am/ }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await stepHeading(4)
    await user.click(await screen.findByRole('button', { name: 'Next' }))
    await stepHeading(5)
    await user.click(screen.getByRole('button', { name: 'Book appointment' }))

    const banner = await screen.findByTestId('branch-full-suggestion')
    expect(within(banner).getByText('MDC Nigdi')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Book appointment' })).toBeDisabled()
    await user.click(within(banner).getByRole('button', { name: /Switch to MDC Nigdi/ }))
    expect(screen.getByRole('button', { name: 'Book appointment' })).toBeEnabled()
  })
})

describe('patient dashboard', () => {
  it('cancels an appointment through the accessible dialog', async () => {
    const user = userEvent.setup()
    let current = appointment()
    const patches: unknown[] = []
    mockApi(
      (path, init) => {
        if (path.startsWith('/appointments?scope=upcoming')) {
          return { status: 200, body: { appointments: current.status === 'confirmed' ? [current] : [] } }
        }
        if (path.startsWith('/appointments?scope=past')) {
          return { status: 200, body: { appointments: current.status === 'cancelled' ? [current] : [] } }
        }
        if (path === '/appointments/a1/cancel' && init.method === 'PATCH') {
          patches.push(JSON.parse(String(init.body)))
          current = appointment({ status: 'cancelled', can_cancel: false, can_reschedule: false })
          return { status: 200, body: { appointment: current } }
        }
        return undefined
      },
      makeUser('patient'),
    )
    renderApp('/portal/patient')

    expect(await screen.findByRole('heading', { level: 3, name: 'Dating Scan' })).toBeInTheDocument()
    const trigger = screen.getByRole('button', { name: 'Cancel' })
    await user.click(trigger)

    const dialog = await screen.findByRole('dialog', { name: 'Cancel this appointment?' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()

    await user.click(trigger)
    const again = await screen.findByRole('dialog')
    await user.type(within(again).getByLabelText('Reason (optional)'), 'Travelling')
    await user.click(within(again).getByRole('button', { name: 'Cancel appointment' }))

    expect(await screen.findByText(/MDC-TEST01 was cancelled/)).toBeInTheDocument()
    expect(patches).toEqual([{ reason: 'Travelling' }])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByText('You have no upcoming appointments.')).toBeInTheDocument()
  })

  it('rejects a script payload in the cancellation reason before sending', async () => {
    const user = userEvent.setup()
    mockApi(
      (path) =>
        path.startsWith('/appointments?scope=upcoming')
          ? { status: 200, body: { appointments: [appointment()] } }
          : path.startsWith('/appointments?scope=past')
            ? { status: 200, body: { appointments: [] } }
            : undefined,
      makeUser('patient'),
    )
    renderApp('/portal/patient')
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Reason (optional)'), '<script>alert(1)</script>')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/not allowed/)
    expect(within(dialog).getByRole('button', { name: 'Cancel appointment' })).toBeDisabled()
  })
})

describe('reception dashboard', () => {
  it('checks a patient in, shows attention flags and updates urgency', async () => {
    const user = userEvent.setup()
    let current = appointment({
      needs_attention: true,
      attention_count: 1,
      attention: [{ code: 'blood_thinners', question: 'Do you take blood thinners?', answer: 'yes' }],
    })
    const patches: unknown[] = []
    mockApi(
      baseHandler((path, init) => {
        if (path.startsWith('/appointments?')) {
          expect(path).toContain(`date=${todayIso()}`)
          return { status: 200, body: { appointments: [current] } }
        }
        if (path === '/appointments/a1/status' && init.method === 'PATCH') {
          const body = JSON.parse(String(init.body)) as { status?: Appointment['status']; urgency?: Appointment['urgency'] }
          patches.push(body)
          current = { ...current, status: body.status ?? current.status, urgency: body.urgency ?? current.urgency }
          return { status: 200, body: { appointment: current } }
        }
        return undefined
      }),
      makeUser('receptionist'),
    )
    renderApp('/portal/reception')

    expect(await screen.findByRole('heading', { level: 3, name: 'Asha Kulkarni' })).toBeInTheDocument()
    expect(screen.getByText('Needs attention')).toBeInTheDocument()
    expect(screen.getByText(/Do you take blood thinners/)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Urgency for Asha Kulkarni'), 'Urgent')
    await waitFor(() => expect(patches).toContainEqual({ urgency: 'Urgent' }))

    await user.click(screen.getByRole('button', { name: 'Check in Asha Kulkarni' }))
    await waitFor(() => expect(patches).toContainEqual({ status: 'checked_in' }))
    expect(await screen.findByText('Checked in')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Complete Asha Kulkarni' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check in Asha Kulkarni' })).not.toBeInTheDocument()
  })

  it('shows the server message when a status change is refused', async () => {
    const user = userEvent.setup()
    mockApi(
      baseHandler((path, init) => {
        if (path.startsWith('/appointments?')) {
          return { status: 200, body: { appointments: [appointment()] } }
        }
        if (init.method === 'PATCH') {
          return { status: 409, body: { code: 'CONFLICT', message: 'Patients can be checked in only on the day of the appointment.' } }
        }
        return undefined
      }),
      makeUser('receptionist'),
    )
    renderApp('/portal/reception')
    await user.click(await screen.findByRole('button', { name: 'Check in Asha Kulkarni' }))
    expect(await screen.findByText(/only on the day of the appointment/)).toBeInTheDocument()
  })
})

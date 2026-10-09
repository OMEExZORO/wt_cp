import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeUser, mockApi, renderApp } from '../../test/utils'
import { sortQueue } from '../../lib/alerts'
import type { AlertBanner, QueueItem, RecentReport, StaffAlert } from '../../types/alerts'
import { ReadingQueueTable } from './ReadingQueueTable'

afterEach(() => {
  vi.unstubAllGlobals()
})

const banner: AlertBanner = {
  id: '11111111-1111-4111-8111-111111111111',
  status: 'notified',
  audience: 'patient',
  title: 'Important: your report needs attention',
  message: 'A finding in your Ultrasound report (reference MDC-1) needs urgent attention.',
  patient_name: null,
  scan_name: 'Ultrasound',
  reference_code: 'MDC-1',
  requires_acknowledgement: true,
  created_at: '2026-10-09T14:00:00+05:30',
}

function queueItem(reference: string, urgency: QueueItem['urgency'], minutes: number, level: QueueItem['wait_level'] = 'ok'): QueueItem {
  return {
    appointment_id: reference,
    reference_code: reference,
    patient_name: `Patient ${reference}`,
    scan_name: 'Whole Abdomen',
    modality: 'USG',
    branch_name: 'Bhosari',
    urgency,
    is_referred: false,
    waiting_since: null,
    waiting_minutes: minutes,
    wait_level: level,
  }
}

describe('critical alert banner', () => {
  it('shows an accessible alert banner to a patient and removes it after acknowledging', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    mockApi((path, init) => {
      if (path === '/alerts/mine') return { status: 200, body: { alerts: calls.includes('ack') ? [] : [banner] } }
      if (path === `/alerts/${banner.id}/acknowledge` && init.method === 'POST') {
        calls.push('ack')
        return { status: 200, body: { alert_id: banner.id, status: 'acknowledged', acknowledged_at: '2026-10-09T14:05:00+05:30' } }
      }
      return undefined
    }, makeUser('patient'))
    renderApp('/portal/patient')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('needs urgent attention')
    await user.click(within(alert).getByRole('button', { name: 'Acknowledge' }))

    await waitFor(() => expect(screen.queryByText(/needs urgent attention/)).not.toBeInTheDocument())
    expect(calls).toEqual(['ack'])
  })

  it('does not request alerts for staff roles', async () => {
    const fetchMock = mockApi((path) => (path === '/doctor/queue' ? { status: 200, body: { queue: [], recent_reports: [], generated_at: '' } } : undefined), makeUser('doctor'))
    renderApp('/portal/doctor')
    await screen.findByText('No scans are waiting to be reported.')
    const paths = fetchMock.mock.calls.map(([input]) => String(input))
    expect(paths.some((path) => path.includes('/alerts/mine'))).toBe(false)
  })

  it('keeps the banner and shows an error when acknowledging fails', async () => {
    const user = userEvent.setup()
    mockApi((path, init) => {
      if (path === '/alerts/mine') return { status: 200, body: { alerts: [banner] } }
      if (path.endsWith('/acknowledge') && init.method === 'POST') {
        return { status: 500, body: { code: 'SERVER_ERROR', message: 'Could not acknowledge right now.' } }
      }
      return undefined
    }, makeUser('patient'))
    renderApp('/portal/patient')
    await user.click(await screen.findByRole('button', { name: 'Acknowledge' }))
    expect(await screen.findByText('Could not acknowledge right now.')).toBeInTheDocument()
    expect(screen.getByText(/needs urgent attention/)).toBeInTheDocument()
  })
})

describe('priority reading queue', () => {
  it('orders Urgent before Priority before Routine, then by longest wait', () => {
    const sorted = sortQueue([
      queueItem('R1', 'Routine', 400),
      queueItem('P1', 'Priority', 10),
      queueItem('P2', 'Priority', 90),
      queueItem('U1', 'Urgent', 5),
    ])
    expect(sorted.map((item) => item.reference_code)).toEqual(['U1', 'P2', 'P1', 'R1'])
  })

  it('renders rows in priority order with urgency text and a waiting indicator', () => {
    render(
      <ReadingQueueTable
        items={[queueItem('R1', 'Routine', 400, 'overdue'), queueItem('U1', 'Urgent', 75, 'overdue'), queueItem('P1', 'Priority', 10)]}
      />,
    )
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('Urgent')
    expect(rows[0]).toHaveTextContent('1 h 15 min')
    expect(rows[0]).toHaveTextContent('Overdue')
    expect(rows[1]).toHaveTextContent('Priority')
    expect(rows[2]).toHaveTextContent('Routine')
    expect(rows[2]).toHaveTextContent('6 h 40 min')
  })

  it('shows an empty state', () => {
    render(<ReadingQueueTable items={[]} />)
    expect(screen.getByText('No scans are waiting to be reported.')).toBeInTheDocument()
  })
})

describe('doctor dashboard flag critical', () => {
  const report: RecentReport = {
    report_id: '22222222-2222-4222-8222-222222222222',
    title: 'USG abdomen',
    status: 'final',
    is_critical: false,
    reference_code: 'MDC-9',
    patient_name: 'Asha Patil',
    scan_name: 'Whole Abdomen',
    alert_id: null,
    alert_status: null,
    created_at: '2026-10-09T10:00:00+05:30',
  }

  it('asks for confirmation in a dialog before flagging and sends nothing on cancel', async () => {
    const user = userEvent.setup()
    const posts: string[] = []
    mockApi((path, init) => {
      if (path === '/doctor/queue') {
        return { status: 200, body: { queue: [queueItem('U1', 'Urgent', 20)], recent_reports: [report], generated_at: '2026-10-09T14:00:00+05:30' } }
      }
      if (path.endsWith('/critical') && init.method === 'POST') {
        posts.push(path)
        return { status: 201, body: { alert: {}, note_stored: false } }
      }
      return undefined
    }, makeUser('doctor'))
    renderApp('/portal/doctor')

    await user.click(await screen.findByRole('button', { name: 'Flag critical' }))
    const dialog = await screen.findByRole('dialog', { name: 'Flag this report as critical?' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(posts).toEqual([])

    await user.click(screen.getByRole('button', { name: 'Flag critical' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Flag as critical' }))
    await waitFor(() => expect(posts).toEqual([`/reports/${report.report_id}/critical`]))
    expect(await screen.findByText(/Critical alert raised for Asha Patil/)).toBeInTheDocument()
  })
})

describe('reception alerts board', () => {
  const flagged: StaffAlert = {
    id: '33333333-3333-4333-8333-333333333333',
    status: 'escalated',
    escalation_level: 2,
    notify_count: 4,
    red_flag: true,
    staff_flagged_at: '2026-10-09T14:30:00+05:30',
    patient_name: 'Ravi Kale',
    patient_phone: '9000000004',
    referrer_name: null,
    scan_name: 'CT Brain',
    reference_code: 'MDC-5',
    report_id: 'r',
    raised_by_name: 'Dev Doctor',
    created_at: '2026-10-09T14:00:00+05:30',
    last_notified_at: null,
    next_escalation_at: null,
    acknowledged_at: null,
    acknowledged_by_name: null,
    resolved_at: null,
    resolved_by_name: null,
    resolution_note: null,
  }

  it('highlights red flagged rows, offers a phone link and requires a note to resolve', async () => {
    const user = userEvent.setup()
    const resolved: unknown[] = []
    mockApi((path, init) => {
      if (path.startsWith('/alerts?')) return { status: 200, body: { alerts: [flagged] } }
      if (path === `/alerts/${flagged.id}/resolve` && init.method === 'PATCH') {
        resolved.push(JSON.parse(String(init.body)))
        return { status: 200, body: { alert: { ...flagged, status: 'resolved' } } }
      }
      return undefined
    }, makeUser('receptionist'))
    renderApp('/portal/reception')

    const row = await screen.findByTestId(`alert-row-${flagged.id}`)
    expect(row).toHaveClass('row--red-flag')
    expect(within(row).getByRole('link', { name: 'Phone patient' })).toHaveAttribute('href', 'tel:9000000004')

    await user.click(within(row).getByRole('button', { name: 'Resolve' }))
    const dialog = await screen.findByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: 'Mark as resolved' })
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByLabelText(/Call note/), 'Spoke to patient, will attend today')
    expect(confirm).toBeEnabled()
    await user.click(confirm)
    await waitFor(() => expect(resolved).toEqual([{ note: 'Spoke to patient, will attend today' }]))
  })
})

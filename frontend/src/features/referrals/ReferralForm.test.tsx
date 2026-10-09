import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeUser, mockApi, renderApp } from '../../test/utils'
import { ReferralForm } from './ReferralForm'

const scanOptions = [{ value: 'b5f42efe-2cfb-4906-aacb-05bef76a01ed', label: 'CT Brain (CT)' }]

afterEach(() => {
  vi.unstubAllGlobals()
})

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/patient name/i), 'Asha Patil')
  await user.type(screen.getByLabelText(/patient mobile number/i), '9876543210')
  await user.selectOptions(screen.getByLabelText(/scan requested/i), scanOptions[0].value)
}

function referralBody(overrides: Record<string, unknown> = {}) {
  return {
    id: 'f1',
    reference_code: 'RF-261009-ABCDEF',
    patient_name: 'Asha Patil',
    patient_phone: '9876543210',
    patient_email: null,
    scan_type: { id: scanOptions[0].value, name: 'CT Brain', modality: 'CT' },
    preferred_branch: null,
    urgency: 'Routine',
    status: 'submitted',
    status_changed_at: '2026-10-09T10:00:00+05:30',
    created_at: '2026-10-09T10:00:00+05:30',
    appointment: null,
    clinical_notes: null,
    reports: [],
    ...overrides,
  }
}

describe('ReferralForm', () => {
  it('keeps the send button disabled until required fields are valid', async () => {
    mockApi(() => undefined)
    const user = userEvent.setup()
    render(<ReferralForm scanOptions={scanOptions} />)
    const button = screen.getByRole('button', { name: 'Send referral' })
    expect(button).toBeDisabled()
    await user.type(screen.getByLabelText(/patient name/i), 'Asha Patil')
    await user.type(screen.getByLabelText(/patient mobile number/i), '12345')
    await user.selectOptions(screen.getByLabelText(/scan requested/i), scanOptions[0].value)
    expect(button).toBeDisabled()
    await user.clear(screen.getByLabelText(/patient mobile number/i))
    await user.type(screen.getByLabelText(/patient mobile number/i), '9876543210')
    expect(button).toBeEnabled()
  })

  it('shows inline errors for a bad phone, bad email and hostile input', async () => {
    mockApi(() => undefined)
    const user = userEvent.setup()
    render(<ReferralForm scanOptions={scanOptions} />)
    await user.type(screen.getByLabelText(/patient mobile number/i), '12345')
    await user.tab()
    expect(await screen.findByText('Enter a valid 10 digit Indian mobile number.')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/patient email/i), 'not-an-email')
    await user.tab()
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/patient name/i), "' OR '1'='1")
    await user.tab()
    expect(await screen.findByText('This field contains characters or patterns that are not allowed.')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/clinical notes/i), '<script>alert(1)</script>')
    await user.tab()
    expect(screen.getAllByText('This field contains characters or patterns that are not allowed.')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Send referral' })).toBeDisabled()
  })

  it('posts the referral and confirms with the reference code', async () => {
    let body: Record<string, unknown> | null = null
    mockApi((path, init) => {
      if (path === '/referrals' && init.method === 'POST') {
        body = JSON.parse(String(init.body)) as Record<string, unknown>
        return { status: 201, body: { referral: referralBody() } }
      }
      return undefined
    })
    const onCreated = vi.fn()
    const user = userEvent.setup()
    render(<ReferralForm scanOptions={scanOptions} onCreated={onCreated} />)
    await fillValid(user)
    await user.type(screen.getByLabelText(/clinical notes/i), 'Right flank pain for 3 days')
    await user.click(screen.getByRole('button', { name: 'Send referral' }))
    expect(await screen.findByText(/RF-261009-ABCDEF/)).toBeInTheDocument()
    expect(onCreated).toHaveBeenCalledTimes(1)
    expect(body).toMatchObject({
      patient_name: 'Asha Patil',
      patient_phone: '9876543210',
      scan_type_id: scanOptions[0].value,
      urgency: 'Routine',
      clinical_notes: 'Right flank pain for 3 days',
    })
    expect(body).not.toHaveProperty('patient_email')
  })

  it('shows server field errors', async () => {
    mockApi((path, init) =>
      path === '/referrals' && init.method === 'POST'
        ? { status: 422, body: { code: 'VALIDATION_FAILED', message: 'Please correct the highlighted fields.', fields: { scan_type_id: 'Choose a scan from the list.' } } }
        : undefined,
    )
    const user = userEvent.setup()
    render(<ReferralForm scanOptions={scanOptions} />)
    await fillValid(user)
    await user.click(screen.getByRole('button', { name: 'Send referral' }))
    expect(await screen.findByText('Choose a scan from the list.')).toBeInTheDocument()
  })
})

describe('ReferrerDashboard', () => {
  it('lists referrals with status and a download link when the report is ready', async () => {
    const report = {
      id: 'r1',
      title: 'CT Brain report',
      status: 'final',
      mime_type: 'application/pdf',
      size_bytes: 2048,
      original_filename: 'ct.pdf',
      is_critical: false,
      patient: { id: 'p', name: 'Asha Patil' },
      appointment: { id: 'a', reference_code: 'MDC-261009-AAAAA', scan_name: 'CT Brain', date: '2026-10-09' },
      released_at: '2026-10-09T10:00:00+05:30',
      created_at: '2026-10-09T10:00:00+05:30',
      updated_at: '2026-10-09T10:00:00+05:30',
    }
    mockApi((path) => {
      if (path.startsWith('/referrals')) {
        return { status: 200, body: { referrals: [referralBody({ status: 'report_ready', reports: [report] })] } }
      }
      if (path.startsWith('/public/scan-types')) {
        return { status: 200, body: { scan_types: [] } }
      }
      return undefined
    }, makeUser('referrer'))
    renderApp('/portal/referrer')
    expect(await screen.findByText('Report ready')).toBeInTheDocument()
    const link = await screen.findByRole('link', { name: /download ct brain report/i })
    expect(link).toHaveAttribute('href', '/api/v1/reports/r1/download')
  })
})

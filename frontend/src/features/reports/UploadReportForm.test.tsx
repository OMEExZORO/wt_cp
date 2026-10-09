import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi } from '../../test/utils'
import { validateReportFile, MAX_REPORT_BYTES } from '../../lib/reportFile'
import type { StaffAppointmentOption } from '../../types/report'
import { UploadReportForm } from './UploadReportForm'

const appointments: StaffAppointmentOption[] = [
  {
    id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
    reference_code: 'MDC-261009-AAAAA',
    status: 'completed',
    patient: { full_name: 'Dev Patient' },
    scan_type: { name: 'CT Brain' },
    slot: { date: '2026-10-09', start_time: '09:00' },
  },
]

function pdf(name = 'scan.pdf', type = 'application/pdf'): File {
  return new File(['%PDF-1.4 test'], name, { type })
}

function sizedFile(name: string, type: string, size: number): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

afterEach(() => {
  vi.unstubAllGlobals()
})

async function fillValid(user: ReturnType<typeof userEvent.setup>, file: File = pdf()) {
  await user.selectOptions(screen.getByLabelText(/^appointment/i), appointments[0].id)
  await user.type(screen.getByLabelText(/report title/i), 'CT Brain report')
  await user.upload(screen.getByLabelText(/report file/i), file)
}

describe('validateReportFile', () => {
  it('accepts matching pdf, jpeg and png files', () => {
    expect(validateReportFile(pdf())).toBeNull()
    expect(validateReportFile(new File(['x'], 'a.jpg', { type: 'image/jpeg' }))).toBeNull()
    expect(validateReportFile(new File(['x'], 'a.jpeg', { type: 'image/jpeg' }))).toBeNull()
    expect(validateReportFile(new File(['x'], 'a.png', { type: 'image/png' }))).toBeNull()
  })

  it('rejects missing, empty, oversize, mismatched and executable-looking files', () => {
    expect(validateReportFile(null)).toMatch(/choose a file/i)
    expect(validateReportFile(new File([], 'a.pdf', { type: 'application/pdf' }))).toMatch(/empty/i)
    expect(validateReportFile(sizedFile('big.pdf', 'application/pdf', MAX_REPORT_BYTES + 1))).toMatch(/too large/i)
    expect(validateReportFile(new File(['x'], 'a.txt', { type: 'text/plain' }))).toMatch(/only pdf/i)
    expect(validateReportFile(new File(['x'], 'a.png', { type: 'application/pdf' }))).toMatch(/does not match/i)
    expect(validateReportFile(new File(['x'], 'shell.php.pdf', { type: 'application/pdf' }))).toMatch(/not allowed/i)
  })
})

describe('UploadReportForm', () => {
  it('keeps the upload button disabled until the form and file are valid', async () => {
    mockApi(() => undefined)
    const user = userEvent.setup({ applyAccept: false })
    render(<UploadReportForm appointments={appointments} />)
    const button = screen.getByRole('button', { name: 'Upload report' })
    expect(button).toBeDisabled()
    await user.selectOptions(screen.getByLabelText(/^appointment/i), appointments[0].id)
    await user.type(screen.getByLabelText(/report title/i), 'CT Brain report')
    expect(button).toBeDisabled()
    await user.upload(screen.getByLabelText(/report file/i), pdf())
    expect(button).toBeEnabled()
  })

  it('rejects a text file with a pdf extension and an oversize file', async () => {
    mockApi(() => undefined)
    const user = userEvent.setup({ applyAccept: false })
    render(<UploadReportForm appointments={appointments} />)
    await fillValid(user, new File(['hello'], 'scan.pdf', { type: 'text/plain' }))
    expect(await screen.findByText('Only PDF, JPG and PNG files are allowed.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload report' })).toBeDisabled()

    await user.upload(screen.getByLabelText(/report file/i), sizedFile('big.pdf', 'application/pdf', MAX_REPORT_BYTES + 1))
    expect(await screen.findByText(/too large/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload report' })).toBeDisabled()
  })

  it('rejects script and SQL payloads in the title', async () => {
    mockApi(() => undefined)
    const user = userEvent.setup({ applyAccept: false })
    render(<UploadReportForm appointments={appointments} />)
    await fillValid(user)
    const title = screen.getByLabelText(/report title/i)
    await user.clear(title)
    await user.type(title, '<script>alert(1)</script>')
    await user.tab()
    expect(await screen.findByText('This field contains characters or patterns that are not allowed.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload report' })).toBeDisabled()
    await user.clear(title)
    await user.type(title, "'; DROP TABLE users;--")
    expect(screen.getByRole('button', { name: 'Upload report' })).toBeDisabled()
  })

  it('posts multipart data and shows success', async () => {
    let posted: FormData | null = null
    const fetchMock = mockApi((path, init) => {
      if (path === '/reports' && init.method === 'POST') {
        posted = init.body as FormData
        return {
          status: 201,
          body: {
            report: {
              id: 'r1',
              title: 'CT Brain report',
              status: 'final',
              mime_type: 'application/pdf',
              size_bytes: 13,
              original_filename: 'scan.pdf',
              is_critical: false,
              patient: { id: 'p', name: 'Dev Patient' },
              appointment: { id: appointments[0].id, reference_code: 'MDC-261009-AAAAA', scan_name: 'CT Brain', date: '2026-10-09' },
              released_at: null,
              created_at: '2026-10-09T10:00:00+05:30',
              updated_at: '2026-10-09T10:00:00+05:30',
              uploaded_by: 'Dev Doctor',
              has_referrer: false,
            },
          },
        }
      }
      return undefined
    })
    const onUploaded = vi.fn()
    const user = userEvent.setup({ applyAccept: false })
    render(<UploadReportForm appointments={appointments} onUploaded={onUploaded} />)
    await fillValid(user)
    await user.click(screen.getByRole('button', { name: 'Upload report' }))
    expect(await screen.findByText(/was uploaded and encrypted/i)).toBeInTheDocument()
    expect(onUploaded).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalled()
    expect(posted).toBeInstanceOf(FormData)
    const form = posted as unknown as FormData
    expect(form.get('appointment_id')).toBe(appointments[0].id)
    expect(form.get('title')).toBe('CT Brain report')
    expect((form.get('file') as File).name).toBe('scan.pdf')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Upload report' })).toBeDisabled())
  })

  it('shows the server error and field errors when the upload is refused', async () => {
    mockApi((path, init) =>
      path === '/reports' && init.method === 'POST'
        ? { status: 422, body: { code: 'VALIDATION_FAILED', message: 'Please correct the highlighted fields.', fields: { file: 'The file extension does not match the file contents.' } } }
        : undefined,
    )
    const user = userEvent.setup({ applyAccept: false })
    render(<UploadReportForm appointments={appointments} />)
    await fillValid(user)
    await user.click(screen.getByRole('button', { name: 'Upload report' }))
    expect(await screen.findByText('Please correct the highlighted fields.')).toBeInTheDocument()
    expect(screen.getByText('The file extension does not match the file contents.')).toBeInTheDocument()
  })
})

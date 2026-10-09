import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { DataTable, type Column } from '../../components/admin/DataTable'
import { SettingsForm } from '../../components/admin/SettingsForm'
import { adminRules } from '../../lib/adminValidation'
import { makeUser, mockApi, renderApp } from '../../test/utils'
import type { AdminSetting } from '../../types/admin'
import type { Role } from '../../types/auth'
import { filterProblems } from './AuditLogPage'
import { photoProblem } from './DoctorProfilePage'

afterEach(() => {
  vi.unstubAllGlobals()
})

const ADMIN_PATHS = ['/portal/admin', '/portal/admin/users', '/portal/admin/branches', '/portal/admin/catalog', '/portal/admin/slots', '/portal/admin/settings', '/portal/admin/faqs', '/portal/admin/doctor', '/portal/admin/reviews', '/portal/admin/audit-log']
const NON_ADMIN: Role[] = ['patient', 'receptionist', 'doctor', 'referrer']

describe('admin route protection', () => {
  it.each(NON_ADMIN.flatMap((role) => ADMIN_PATHS.map((path) => [role, path] as const)))('blocks %s from %s', async (role, path) => {
    const fetchMock = mockApi(() => undefined, makeUser(role))
    renderApp(path)
    expect(await screen.findByRole('heading', { level: 1, name: 'Access denied' })).toBeInTheDocument()
    const adminCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/admin/'))
    expect(adminCalls).toHaveLength(0)
  })

  it('sends guests to the login page', async () => {
    mockApi(() => undefined)
    renderApp('/portal/admin/audit-log')
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
  })

  it('shows an admin the section navigation and the requested page', async () => {
    mockApi((path) => (path.startsWith('/admin/users') ? { status: 200, body: { users: [], pagination: { page: 1, per_page: 20, total: 0 } } } : undefined), makeUser('admin'))
    renderApp('/portal/admin/users')
    expect(await screen.findByRole('heading', { level: 1, name: 'Users' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Admin sections' })
    expect(within(nav).getAllByRole('link')).toHaveLength(ADMIN_PATHS.length)
    expect(await screen.findByText('No user records yet.')).toBeInTheDocument()
  })

  it('shows the dashboard statistics with an accessible chart', async () => {
    mockApi(
      (path) =>
        path.startsWith('/admin/stats')
          ? {
              status: 200,
              body: {
                window: { from: '2026-09-10', to: '2026-10-09', days: 30 },
                per_day_per_branch: [{ date: '2026-10-09', branch_id: 'b1', branch_name: 'MDC Bhosari', total: 3 }],
                daily_totals: [
                  { date: '2026-10-08', total: 0 },
                  { date: '2026-10-09', total: 3 },
                ],
                by_status: [{ status: 'completed', total: 3 }],
                by_modality: [{ modality: 'USG', total: 3 }],
                appointments_in_window: 3,
                pending_reviews: 2,
              },
            }
          : undefined,
      makeUser('admin'),
    )
    renderApp('/portal/admin')
    expect(await screen.findByRole('img', { name: /bar chart of appointments per day/i })).toBeInTheDocument()
    expect(screen.getByText('Reviews waiting for moderation')).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Completed' })).toBeInTheDocument()
  })
})

interface Row {
  id: string
  name: string
  active: boolean
  note: string | null
}

const COLUMNS: Column<Row>[] = [
  { key: 'name', header: 'Name' },
  { key: 'active', header: 'Active' },
  { key: 'note', header: 'Note' },
]

const ROWS: Row[] = [
  { id: 'a', name: 'Alpha', active: true, note: null },
  { id: 'b', name: 'Beta', active: false, note: 'Needs review' },
]

describe('DataTable', () => {
  it('renders a header per column and a row per record using the row key', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<DataTable caption="Things" columns={COLUMNS} rows={ROWS} rowKey={(row) => row.id} />)
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Name', 'Active', 'Note'])
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(within(rows[1]).getByText('Alpha')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Yes')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Needs review')).toBeInTheDocument()
    expect(within(rows[2]).getByText('No')).toBeInTheDocument()
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })

  it('renders custom cells and action buttons per row', async () => {
    const onEdit = vi.fn()
    const columns: Column<Row>[] = [{ key: 'name', header: 'Name', render: (row) => <strong>{row.name.toUpperCase()}</strong> }]
    render(
      <DataTable
        caption="Things"
        columns={columns}
        rows={ROWS}
        rowKey={(row) => row.id}
        actions={(row) => (
          <button type="button" onClick={() => onEdit(row.id)}>
            Edit {row.name}
          </button>
        )}
      />,
    )
    expect(screen.getByText('ALPHA')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Edit Beta' }))
    expect(onEdit).toHaveBeenCalledWith('b')
  })

  it('shows loading, empty and error states', async () => {
    const onRetry = vi.fn()
    const { rerender } = render(<DataTable caption="Things" columns={COLUMNS} rows={null} rowKey={(row) => row.id} loading />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
    rerender(<DataTable caption="Things" columns={COLUMNS} rows={[]} rowKey={(row) => row.id} emptyMessage="Nothing here yet." />)
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument()
    rerender(<DataTable caption="Things" columns={COLUMNS} rows={null} rowKey={(row) => row.id} error="The server is down." onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toHaveTextContent('The server is down.')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('pages through records', async () => {
    const onPageChange = vi.fn()
    render(<DataTable caption="Things" columns={COLUMNS} rows={ROWS} rowKey={(row) => row.id} pagination={{ page: 2, per_page: 2, total: 5 }} onPageChange={onPageChange} />)
    expect(screen.getByText('Showing 3 to 4 of 5')).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(onPageChange.mock.calls).toEqual([[3], [1]])
  })
})

function setting(overrides: Partial<AdminSetting>): AdminSetting {
  return {
    key: 'contact.phone',
    value: null,
    type: 'phone',
    group: 'contact',
    label: 'Main phone number',
    is_public: true,
    is_placeholder: true,
    is_editable: true,
    is_required: false,
    updated_at: null,
    ...overrides,
  }
}

describe('SettingsForm validation', () => {
  const SETTINGS: AdminSetting[] = [
    setting({}),
    setting({ key: 'links.google_reviews_url', type: 'url', group: 'contact', label: 'Google reviews page' }),
    setting({ key: 'contact.email', type: 'email', label: 'Contact email' }),
  ]

  it('rejects a bad phone number, an http link and a bad email without calling the API', async () => {
    const fetchMock = mockApi(() => undefined)
    const onSaved = vi.fn()
    const user = userEvent.setup()
    render(<SettingsForm settings={SETTINGS} groups={['contact']} onSaved={onSaved} />)

    await user.type(screen.getByLabelText('Main phone number'), '12345')
    await user.type(screen.getByLabelText('Google reviews page'), 'http://g.page/example')
    await user.type(screen.getByLabelText('Contact email'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Save settings' }))

    expect(await screen.findByText('Enter a valid 10 digit Indian mobile number.')).toBeInTheDocument()
    expect(screen.getByText('Enter a link that starts with https://')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/admin/settings'))).toHaveLength(0)
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('rejects script and SQL payloads', async () => {
    mockApi(() => undefined)
    const user = userEvent.setup()
    render(<SettingsForm settings={[setting({ key: 'contact.opening_hours', type: 'text', label: 'Opening hours' })]} groups={['contact']} onSaved={vi.fn()} />)
    await user.type(screen.getByLabelText('Opening hours'), '<script>alert(1)</script>')
    await user.click(screen.getByRole('button', { name: 'Save settings' }))
    expect(await screen.findByText('This field contains characters or patterns that are not allowed.')).toBeInTheDocument()
  })

  it('sends only the changed values when the form is valid', async () => {
    const saved = [setting({ value: '9876543210', is_placeholder: false })]
    const fetchMock = mockApi((path, init) => (path === '/admin/settings' && init.method === 'PATCH' ? { status: 200, body: { settings: saved } } : undefined))
    const onSaved = vi.fn()
    const user = userEvent.setup()
    render(<SettingsForm settings={SETTINGS} groups={['contact']} onSaved={onSaved} />)
    await user.type(screen.getByLabelText('Main phone number'), '98765 43210')
    await user.type(screen.getByLabelText('Google reviews page'), 'https://g.page/r/example/review')
    await user.click(screen.getByRole('button', { name: 'Save settings' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved))
    const patch = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith('/admin/settings') && init?.method === 'PATCH')
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({
      settings: { 'contact.phone': '98765 43210', 'links.google_reviews_url': 'https://g.page/r/example/review' },
    })
  })

  it('does not offer read-only settings', () => {
    render(<SettingsForm settings={[setting({ key: 'legal.pcpndt_notice', group: 'contact', is_editable: false, label: 'PCPNDT notice' })]} groups={['contact']} onSaved={vi.fn()} />)
    expect(screen.queryByLabelText('PCPNDT notice')).not.toBeInTheDocument()
    expect(screen.getByText('There are no editable settings in this section.')).toBeInTheDocument()
  })
})

describe('admin validation helpers', () => {
  it.each([
    ['https://g.page/r/abc/review', true],
    ['https://www.google.com/maps?cid=1&hl=en', true],
    ['http://g.page/x', false],
    ['javascript:alert(1)', false],
    ['https://user:pass@example.com', false],
    ['https://example.com/a b', false],
  ])('httpsUrl %s', (value, valid) => {
    expect(adminRules.httpsUrl()(value, {}) === null).toBe(valid)
  })

  it('checks integer ranges', () => {
    expect(adminRules.integerBetween(1, 50)('0', {})).toBe('Must be at least 1.')
    expect(adminRules.integerBetween(1, 50)('51', {})).toBe('Must be at most 50.')
    expect(adminRules.integerBetween(1, 50)('abc', {})).toBe('Enter a whole number.')
    expect(adminRules.integerBetween(1, 50)('25', {})).toBeNull()
  })

  it('validates audit log filters', () => {
    expect(filterProblems({ action: 'admin.faq_created', actor_role: '', entity_type: 'faq', from: '2026-10-01', to: '2026-10-09' })).toEqual({})
    expect(filterProblems({ action: "x' OR '1'='1", actor_role: '', entity_type: '', from: '', to: '' }).action).toBeDefined()
    expect(filterProblems({ action: '', actor_role: '', entity_type: '', from: '2026-10-09', to: '2026-10-01' }).to).toBeDefined()
  })

  it('validates the doctor photo before uploading', () => {
    expect(photoProblem({ type: 'image/png', size: 1000 })).toBeNull()
    expect(photoProblem({ type: 'application/pdf', size: 1000 })).toMatch(/JPEG, PNG or WebP/)
    expect(photoProblem({ type: 'image/jpeg', size: 3 * 1024 * 1024 })).toMatch(/2 MB/)
  })
})

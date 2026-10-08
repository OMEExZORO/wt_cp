import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeUser, mockApi, renderApp } from '../../test/utils'
import type { Role } from '../../types/auth'

afterEach(() => {
  vi.unstubAllGlobals()
})

const cases: { role: Role; heading: string; path: string }[] = [
  { role: 'patient', heading: 'Patient dashboard', path: '/portal/patient' },
  { role: 'doctor', heading: 'Doctor dashboard', path: '/portal/doctor' },
  { role: 'receptionist', heading: 'Reception dashboard', path: '/portal/reception' },
  { role: 'admin', heading: 'Admin dashboard', path: '/portal/admin' },
  { role: 'referrer', heading: 'Referrer dashboard', path: '/portal/referrer' },
]

describe('LoginPage', () => {
  it.each(cases)('redirects a $role to $path after signing in', async ({ role, heading }) => {
    const fetchMock = mockApi((path) => (path === '/auth/login' ? { status: 200, body: { user: makeUser(role) } } : undefined))
    const user = userEvent.setup()
    renderApp('/login')

    await user.type(await screen.findByLabelText(/email address/i), `${role}@diagnocare.test`)
    await user.type(screen.getByLabelText(/^password/i), 'Correct@Pass2026')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
    const loginCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/auth/login'))
    expect(loginCall).toBeDefined()
    const headers = new Headers(loginCall?.[1]?.headers)
    expect(headers.get('X-CSRF-Token')).toBe('test-token')
    expect(loginCall?.[1]?.credentials).toBe('include')
  })

  it('keeps the submit button disabled until the form is valid', async () => {
    mockApi(() => undefined)
    const user = userEvent.setup()
    renderApp('/login')
    const button = await screen.findByRole('button', { name: 'Sign in' })
    expect(button).toBeDisabled()

    await user.type(screen.getByLabelText(/email address/i), 'not-an-email')
    await user.type(screen.getByLabelText(/^password/i), 'something')
    expect(button).toBeDisabled()

    await user.clear(screen.getByLabelText(/email address/i))
    await user.type(screen.getByLabelText(/email address/i), 'patient@diagnocare.test')
    expect(button).toBeEnabled()
  })

  it('shows the generic server error and stays on the login page', async () => {
    mockApi((path) =>
      path === '/auth/login' ? { status: 401, body: { code: 'UNAUTHENTICATED', message: 'Incorrect email or password.' } } : undefined,
    )
    const user = userEvent.setup()
    renderApp('/login')
    await user.type(await screen.findByLabelText(/email address/i), 'patient@diagnocare.test')
    await user.type(screen.getByLabelText(/^password/i), 'Wrong@Pass2026')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Incorrect email or password.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('sends an authenticated user away from the login page to their dashboard', async () => {
    mockApi(() => undefined, makeUser('doctor'))
    renderApp('/login')
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Doctor dashboard' })).toBeInTheDocument())
  })
})

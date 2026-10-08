import { screen } from '@testing-library/react'
import { makeUser, mockApi, renderApp } from '../test/utils'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ProtectedRoute', () => {
  it.each(['/portal/patient', '/portal/doctor', '/portal/reception', '/portal/admin', '/portal/referrer', '/portal/account'])(
    'sends a guest from %s to the login page',
    async (path) => {
      mockApi(() => undefined)
      renderApp(path)
      expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
    },
  )

  it('shows the 403 page when a patient opens the admin dashboard', async () => {
    mockApi(() => undefined, makeUser('patient'))
    renderApp('/portal/admin')
    expect(await screen.findByRole('heading', { level: 1, name: 'Access denied' })).toBeInTheDocument()
  })

  it('shows the 403 page when a referrer opens the doctor dashboard', async () => {
    mockApi(() => undefined, makeUser('referrer'))
    renderApp('/portal/doctor')
    expect(await screen.findByRole('heading', { level: 1, name: 'Access denied' })).toBeInTheDocument()
  })

  it('lets the right role in', async () => {
    mockApi(() => undefined, makeUser('receptionist'))
    renderApp('/portal/reception')
    expect(await screen.findByRole('heading', { level: 1, name: 'Reception dashboard' })).toBeInTheDocument()
  })

  it('returns the user to the page they asked for after login', async () => {
    mockApi((path) => (path === '/auth/login' ? { status: 200, body: { user: makeUser('patient') } } : undefined))
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    renderApp('/portal/account')
    await user.type(await screen.findByLabelText(/email address/i), 'patient@diagnocare.test')
    await user.type(screen.getByLabelText(/^password/i), 'Correct@Pass2026')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'My account' })).toBeInTheDocument()
  })
})

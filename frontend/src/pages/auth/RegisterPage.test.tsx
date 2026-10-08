import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeUser, mockApi, renderApp } from '../../test/utils'

afterEach(() => {
  vi.unstubAllGlobals()
})

async function fillCommon(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText(/full name/i), 'Asha Patil')
  await user.type(screen.getByLabelText(/email address/i), 'asha@example.com')
  await user.type(screen.getByLabelText(/mobile number/i), '9876543210')
  await user.type(screen.getByLabelText(/^password/i), 'Strong@Pass2026')
  await user.type(screen.getByLabelText(/confirm password/i), 'Strong@Pass2026')
}

describe('RegisterPage', () => {
  it('keeps submit disabled until consent is given', async () => {
    mockApi(() => undefined)
    const user = userEvent.setup()
    renderApp('/register')
    await fillCommon(user)
    const button = screen.getByRole('button', { name: 'Create account' })
    expect(button).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: /i consent/i }))
    expect(button).toBeEnabled()
  })

  it('rejects SQL and script payloads in the name field on the client', async () => {
    mockApi(() => undefined)
    const user = userEvent.setup()
    renderApp('/register')
    const name = await screen.findByLabelText(/full name/i)
    await user.type(name, "' OR '1'='1")
    await user.tab()
    expect(await screen.findByText('This field contains characters or patterns that are not allowed.')).toBeInTheDocument()
    await user.clear(name)
    await user.type(name, '<script>alert(1)</script>')
    expect(screen.getByText('This field contains characters or patterns that are not allowed.')).toBeInTheDocument()
  })

  it('asks referrers for registration details and requires them', async () => {
    mockApi(() => undefined)
    const user = userEvent.setup()
    renderApp('/register')
    await user.click(await screen.findByRole('radio', { name: /referring doctor/i }))
    await fillCommon(user)
    await user.click(screen.getByRole('checkbox', { name: /i consent/i }))
    const button = screen.getByRole('button', { name: 'Create account' })
    expect(button).toBeDisabled()
    await user.type(screen.getByLabelText(/qualification/i), 'MBBS, MD')
    await user.type(screen.getByLabelText(/registration number/i), 'MMC/2015/12345')
    await user.type(screen.getByLabelText(/clinic or hospital name/i), 'Patil Clinic')
    await user.type(screen.getByLabelText(/^city/i), 'Pune')
    expect(button).toBeEnabled()
  })

  it('shows server field errors inline and lands on the dashboard on success', async () => {
    let attempt = 0
    mockApi((path) => {
      if (path !== '/auth/register') {
        return undefined
      }
      attempt += 1
      return attempt === 1
        ? { status: 409, body: { code: 'CONFLICT', message: 'An account with this email already exists.', fields: { email: 'Email already registered.' } } }
        : { status: 201, body: { user: makeUser('patient', { email_verified: false, email_verified_at: null }) } }
    })
    const user = userEvent.setup()
    renderApp('/register')
    await fillCommon(user)
    await user.click(screen.getByRole('checkbox', { name: /i consent/i }))
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Email already registered.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Patient dashboard' })).toBeInTheDocument()
    expect(screen.getByText(/please verify your email address/i)).toBeInTheDocument()
  })
})

import { screen } from '@testing-library/react'
import { mockApi, renderApp } from './test/utils'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App routing', () => {
  it('renders the home page heading', async () => {
    mockApi(() => undefined)
    renderApp('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Meghnad Diagnostic Centre' })).toBeInTheDocument()
  })

  it('renders not found for unknown routes', async () => {
    mockApi(() => undefined)
    renderApp('/missing')
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })

  it('shows the PCPNDT notice and medical disclaimer in the footer', async () => {
    mockApi(() => undefined)
    renderApp('/')
    expect(await screen.findByText('Prenatal sex determination is prohibited under the PCPNDT Act.')).toBeInTheDocument()
    expect(screen.getByText(/does not provide medical advice and is not for emergencies/i)).toBeInTheDocument()
  })
})

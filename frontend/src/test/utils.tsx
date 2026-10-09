import { render } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { resetCsrfToken } from '../api/client'
import App from '../App'
import { setupStore, type RootState } from '../app/store'
import { ThemeProvider } from '../context/ThemeContext'
import { clearSessionHint, setSessionHint } from '../features/auth/sessionHint'
import type { Role, User } from '../types/auth'

export function makeUser(role: Role, overrides: Partial<User> = {}): User {
  return {
    id: `00000000-0000-4000-8000-00000000000${['patient', 'doctor', 'receptionist', 'admin', 'referrer'].indexOf(role) + 1}`,
    email: `${role}@diagnocare.test`,
    role,
    full_name: `Dev ${role}`,
    phone: '9000000001',
    email_verified: true,
    email_verified_at: '2026-10-08T20:52:56+05:30',
    last_login_at: null,
    created_at: '2026-10-08T20:52:56+05:30',
    profile: null,
    ...overrides,
  }
}

type Handler = (path: string, init: RequestInit) => { status: number; body: unknown } | undefined

function json(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function mockApi(handler: Handler, me: User | null = null) {
  resetCsrfToken()
  if (me === null) {
    clearSessionHint()
  } else {
    setSessionHint()
  }
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const path = url.replace(/^.*\/api\/v1/, '')
    const custom = handler(path, init)
    if (custom !== undefined) {
      return json(custom.status, custom.status >= 400 ? { data: null, error: custom.body } : { data: custom.body, error: null })
    }
    if (path === '/auth/csrf') {
      return json(200, { data: { csrf_token: 'test-token', header: 'X-CSRF-Token' }, error: null })
    }
    if (path === '/auth/me') {
      return me === null
        ? json(401, { data: null, error: { code: 'UNAUTHENTICATED', message: 'Please sign in to continue.' } })
        : json(200, { data: { user: me }, error: null })
    }
    if (path.startsWith('/dashboards/')) {
      return json(200, { data: { area: path.split('/')[2], title: 'Dashboard', role: me?.role ?? 'patient', widgets: [] }, error: null })
    }
    return json(404, { data: null, error: { code: 'NOT_FOUND', message: 'Not found' } })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export function renderApp(route: string, preloadedState?: Partial<RootState>) {
  const store = setupStore(preloadedState)
  const utils = render(
    <Provider store={store}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <App />
        </MemoryRouter>
      </ThemeProvider>
    </Provider>,
  )
  return { store, ...utils }
}

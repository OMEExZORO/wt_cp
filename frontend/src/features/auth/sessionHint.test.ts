import { mockApi } from '../../test/utils'
import { setupStore } from '../../app/store'
import { fetchMe } from './authSlice'
import { clearSessionHint, hasSessionHint, setSessionHint } from './sessionHint'

afterEach(() => {
  vi.unstubAllGlobals()
  clearSessionHint()
})

describe('session hint', () => {
  it('skips the session request for a guest with no hint', async () => {
    const fetchMock = mockApi(() => undefined)
    clearSessionHint()
    const store = setupStore()
    await store.dispatch(fetchMe())
    expect(fetchMock).not.toHaveBeenCalled()
    expect(store.getState().auth.status).toBe('guest')
  })

  it('asks the server when a hint exists and clears it after a 401', async () => {
    const fetchMock = mockApi(() => undefined)
    setSessionHint()
    const store = setupStore()
    await store.dispatch(fetchMe())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(store.getState().auth.status).toBe('guest')
    expect(hasSessionHint()).toBe(false)
  })
})

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { makeUser, mockApi, renderApp } from '../../test/utils'
import { defaultDisplayName } from './WriteReviewPage'

afterEach(() => {
  vi.unstubAllGlobals()
})

const VISIT = { id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d', reference_code: 'MDC-1234', slot_date: '2026-10-05', scan_name: 'Whole Abdomen', branch_name: 'MDC Bhosari' }

function mine(eligible = [VISIT]) {
  return { reviews: [], eligible_appointments: eligible }
}

describe('Write a review', () => {
  it('is only shown when the patient has a completed visit', async () => {
    mockApi((path) => (path === '/reviews/mine' ? { status: 200, body: mine([]) } : undefined), makeUser('patient'))
    renderApp('/portal/patient/reviews')
    expect(await screen.findByText(/once you have a completed visit/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit review' })).not.toBeInTheDocument()
  })

  it('is not available to other roles', async () => {
    mockApi(() => undefined, makeUser('receptionist'))
    renderApp('/portal/patient/reviews')
    expect(await screen.findByRole('heading', { level: 1, name: 'Access denied' })).toBeInTheDocument()
  })

  it('validates the form before sending anything', async () => {
    const fetchMock = mockApi((path) => (path === '/reviews/mine' ? { status: 200, body: mine() } : undefined), makeUser('patient', { full_name: 'Asha Kulkarni' }))
    const user = userEvent.setup()
    renderApp('/portal/patient/reviews')

    expect(await screen.findByRole('button', { name: 'Submit review' })).toBeInTheDocument()
    expect(screen.getByLabelText(/name shown/i)).toHaveValue('Asha K.')

    await user.click(screen.getByRole('button', { name: 'Submit review' }))
    expect(await screen.findByText('This field is required.')).toBeInTheDocument()
    expect(screen.getByText('You must accept this to continue.')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/^your review/i), 'Too short')
    await user.click(screen.getByRole('button', { name: 'Submit review' }))
    expect(await screen.findByText('Must be at least 10 characters.')).toBeInTheDocument()

    await user.clear(screen.getByLabelText(/^your review/i))
    await user.type(screen.getByLabelText(/^your review/i), '<script>alert(1)</script> nice')
    await user.click(screen.getByRole('button', { name: 'Submit review' }))
    expect(await screen.findByText('This field contains characters or patterns that are not allowed.')).toBeInTheDocument()

    const reviewPosts = fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith('/reviews') && init?.method === 'POST')
    expect(reviewPosts).toHaveLength(0)
  })

  it('submits a valid review and confirms it will be moderated', async () => {
    let submitted: unknown = null
    let eligible = [VISIT]
    const fetchMock = mockApi((path, init) => {
      if (path === '/reviews/mine') {
        return { status: 200, body: mine(eligible) }
      }
      if (path === '/reviews' && init.method === 'POST') {
        submitted = JSON.parse(String(init.body))
        eligible = []
        return { status: 201, body: { id: 'r1', display_name: 'Asha K.', rating: 4, body: 'x', status: 'pending', verified_visit: true, created_at: null } }
      }
      return undefined
    }, makeUser('patient', { full_name: 'Asha Kulkarni' }))
    const user = userEvent.setup()
    renderApp('/portal/patient/reviews')

    await screen.findByRole('button', { name: 'Submit review' })
    await user.selectOptions(screen.getByLabelText(/^rating/i), '4')
    await user.type(screen.getByLabelText(/^your review/i), 'Friendly staff and a quick scan.')
    await user.click(screen.getByLabelText(/i agree that this review/i))
    await user.click(screen.getByRole('button', { name: 'Submit review' }))

    expect(await screen.findByText(/will appear on the website once our team has approved it/i)).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(submitted).toEqual({
      appointment_id: VISIT.id,
      rating: 4,
      body: 'Friendly staff and a quick scan.',
      display_name: 'Asha K.',
      consent: true,
    })
    expect(await screen.findByText(/once you have a completed visit/i)).toBeInTheDocument()
  })

  it('shows the server message when the visit was already reviewed', async () => {
    mockApi((path, init) => {
      if (path === '/reviews/mine') {
        return { status: 200, body: mine() }
      }
      if (path === '/reviews' && init.method === 'POST') {
        return { status: 409, body: { code: 'CONFLICT', message: 'You have already reviewed this visit.' } }
      }
      return undefined
    }, makeUser('patient'))
    const user = userEvent.setup()
    renderApp('/portal/patient/reviews')
    await screen.findByRole('button', { name: 'Submit review' })
    await user.type(screen.getByLabelText(/^your review/i), 'Friendly staff and a quick scan.')
    await user.click(screen.getByLabelText(/i agree that this review/i))
    await user.click(screen.getByRole('button', { name: 'Submit review' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('You have already reviewed this visit.')
  })

  it.each([
    ['Asha Kulkarni', 'Asha K.'],
    ['Asha Rao Patil', 'Asha P.'],
    ['Asha', 'Asha'],
    ['  ', 'Patient'],
  ])('derives the default display name for %j', (fullName, expected) => {
    expect(defaultDisplayName(fullName)).toBe(expected)
  })
})

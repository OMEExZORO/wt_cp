import { ConflictError } from '../../core/errors.js'
import { requireUser } from '../../core/http.js'
import { created, ok } from '../../core/response.js'
import { toIso } from '../../core/time.js'
import { assertEligible, defaultDisplayName } from '../../services/review-policy.js'

const present = (row, timezone) => ({
  id: row.id,
  display_name: row.display_name,
  rating: Number(row.rating),
  body: row.body,
  status: row.status,
  verified_visit: Boolean(row.verified_visit),
  created_at: toIso(row.created_at, timezone),
})

export const store = async (req, app) => {
  const user = requireUser(req)
  const data = await app.validate(req, {
    appointment_id: 'required|uuid',
    rating: 'required|integer|min:1|max:5',
    body: 'required|text|min:10|max:1000',
    display_name: 'nullable|name|min:2|max:80',
    consent: 'required|accepted',
  })
  const repository = app.models.reviewRepository
  const appointment = await repository.appointmentForReview(data.appointment_id)
  assertEligible(appointment, String(user.id), await repository.existsForAppointment(data.appointment_id))

  let review
  try {
    review = await app.models.reviewSubmissions.create({
      patient_id: appointment.patient_id,
      appointment_id: data.appointment_id,
      display_name: data.display_name ?? defaultDisplayName(String(user.full_name)),
      rating: data.rating,
      body: data.body,
      status: 'pending',
      verified_visit: true,
      is_demo: false,
    })
  } catch (error) {
    if (String(error?.code) === '23505') throw new ConflictError('You have already reviewed this visit.')
    throw error
  }
  await app.audit.log('review.submitted', req, { entity_type: 'review', entity_id: review.id, metadata: { rating: data.rating } })
  return created(present(review, app.config.timezone))
}

export const mine = async (req, app) => {
  const userId = String(requireUser(req).id)
  const repository = app.models.reviewRepository
  const timezone = app.config.timezone
  const reviews = await repository.forUser(userId)
  const eligible = await repository.eligibleAppointments(userId)
  return ok({
    reviews: reviews.map((row) => present(row, timezone)),
    eligible_appointments: eligible.map((row) => ({
      id: row.id,
      reference_code: row.reference_code,
      slot_date: row.slot_date,
      scan_name: row.scan_name,
      branch_name: row.branch_name,
    })),
  })
}

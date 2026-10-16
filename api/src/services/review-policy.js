import { ConflictError, NotFoundError, ValidationError } from '../core/errors.js'

export const assertEligible = (appointment, userId, alreadyReviewed) => {
  if (appointment === null || String(appointment.patient_user_id ?? '') !== userId) {
    throw new NotFoundError('Appointment not found.')
  }
  if (appointment.status !== 'completed') {
    throw ValidationError.withField('appointment_id', 'You can review a visit once it has been completed.')
  }
  if (alreadyReviewed) throw new ConflictError('You have already reviewed this visit.')
}

export const defaultDisplayName = (fullName) => {
  const parts = String(fullName).trim().split(/\s+/u).filter(Boolean)
  if (parts.length === 0) return 'Patient'
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${[...parts[parts.length - 1]][0].toUpperCase()}.`
}

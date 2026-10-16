import { ConflictError } from '../../core/errors.js'

export const OPEN_STATUSES = ['open', 'notified', 'escalated']
export const RESOLVABLE = ['open', 'notified', 'escalated', 'acknowledged']
export const STAFF_ROLES = ['receptionist', 'doctor', 'admin']

const TRANSITIONS = {
  open: ['notified', 'escalated', 'acknowledged', 'resolved', 'cancelled'],
  notified: ['escalated', 'acknowledged', 'resolved', 'cancelled'],
  escalated: ['acknowledged', 'resolved', 'cancelled'],
  acknowledged: ['resolved'],
  resolved: [],
  cancelled: [],
}

export const canTransition = (from, to) => Object.hasOwn(TRANSITIONS, from) && TRANSITIONS[from].includes(to)

export const assertTransition = (from, to) => {
  if (!canTransition(from, to)) throw new ConflictError(`An alert that is ${from} cannot become ${to}.`)
}

export const isOpen = (status) => OPEN_STATUSES.includes(status)

export const mayAcknowledge = (user, alert) => {
  const userId = String(user?.id ?? '')
  if (userId === '') return false
  switch (user?.role ?? null) {
    case 'patient':
      return String(alert.patient_user_id ?? '') === userId
    case 'referrer':
      return String(alert.referrer_user_id ?? '') === userId
    default:
      return false
  }
}

export const isRedFlagged = (alert) => Boolean(alert.staff_flagged_at) && isOpen(String(alert.status))

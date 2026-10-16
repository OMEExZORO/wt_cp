export const STAFF_ROLES = ['receptionist', 'doctor', 'admin']
export const RELEASED_STATUSES = ['final', 'amended']

const text = (value) => (value === null || value === undefined ? '' : String(value))

export const canView = (user, report) => {
  if (report.deleted_at) return false
  const role = text(user?.role)
  const userId = text(user?.id)
  if (userId === '') return false
  if (STAFF_ROLES.includes(role)) return true
  if (!RELEASED_STATUSES.includes(text(report.status))) return false
  if (role === 'patient') return text(report.patient_user_id) === userId
  if (role === 'referrer') return text(report.referrer_user_id) === userId
  return false
}

export const canManage = (user) => STAFF_ROLES.includes(text(user?.role))

export const canDelete = (user) => user?.role === 'admin'

export const canSeeClinicalText = (user) => ['doctor', 'admin', 'receptionist'].includes(text(user?.role))

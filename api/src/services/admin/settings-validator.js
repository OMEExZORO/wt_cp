import { HTTPS_URL_PATTERN } from './admin-support.js'

export const NON_CLEARABLE = [
  'clinic.name', 'clinic.short_name', 'clinic.logo_tagline',
  'doctor.name', 'doctor.qualifications', 'doctor.title',
  'alerts.escalation_minutes',
]

export const READ_ONLY_GROUPS = ['legal']
export const READ_ONLY_TYPES = ['json', 'image']

export const isEditable = (row) =>
  !READ_ONLY_GROUPS.includes(String(row.group_name)) && !READ_ONLY_TYPES.includes(String(row.value_type))

export const rulesFor = (row) => {
  const key = String(row.key)
  const presence = NON_CLEARABLE.includes(key) ? ['required'] : ['nullable']
  if (key === 'alerts.escalation_minutes') return [...presence, 'integer', 'min:1', 'max:1440']
  switch (String(row.value_type)) {
    case 'phone':
      return [...presence, 'phone']
    case 'email':
      return [...presence, 'email']
    case 'url':
      return [...presence, 'max:500', `regex:${HTTPS_URL_PATTERN}`]
    case 'text':
      return [...presence, 'text', 'max:2000']
    default:
      return [...presence, 'string', 'max:255']
  }
}

export const buildRules = (rowsByKey) => Object.fromEntries(Object.entries(rowsByKey).map(([key, row]) => [key, rulesFor(row)]))

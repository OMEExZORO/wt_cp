import type { Role } from '../types/auth'

export const ROLE_HOME: Record<Role, string> = {
  patient: '/portal/patient',
  doctor: '/portal/doctor',
  receptionist: '/portal/reception',
  admin: '/portal/admin',
  referrer: '/portal/referrer',
}

export const ROLE_LABEL: Record<Role, string> = {
  patient: 'Patient',
  doctor: 'Doctor',
  receptionist: 'Reception',
  admin: 'Administrator',
  referrer: 'Referring doctor',
}

export const AREA_ROLES: Record<string, Role[]> = {
  '/portal/patient': ['patient'],
  '/portal/doctor': ['doctor', 'admin'],
  '/portal/reception': ['receptionist', 'admin'],
  '/portal/admin': ['admin'],
  '/portal/referrer': ['referrer'],
}

export function homeFor(role: Role): string {
  return ROLE_HOME[role]
}

export function canVisit(role: Role, path: string): boolean {
  const area = Object.keys(AREA_ROLES).find((prefix) => path === prefix || path.startsWith(`${prefix}/`))
  if (area !== undefined) {
    return AREA_ROLES[area].includes(role)
  }
  return path.startsWith('/portal')
}

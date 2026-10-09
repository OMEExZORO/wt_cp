import { NAME_PATTERN, PHONE_PATTERN, normalisePhone } from './validation'
import type { Modality } from '../types/public'

export interface BookPrefill {
  branch: string | null
  name: string | null
  phone: string | null
  modality: Modality | null
}

export const MODALITY_OPTIONS: { value: Modality; label: string }[] = [
  { value: 'USG', label: 'Ultrasound (USG)' },
  { value: 'CT', label: 'CT scan' },
  { value: 'BIOPSY', label: 'Image-guided biopsy' },
]

export function isModality(value: string | null): value is Modality {
  return value === 'USG' || value === 'CT' || value === 'BIOPSY'
}

export function buildBookQuery(values: { branch?: string; name?: string; phone?: string; modality?: string }): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'string' && value.trim() !== '') {
      params.set(key, value.trim())
    }
  }
  return params.toString()
}

export function readBookPrefill(params: URLSearchParams): BookPrefill {
  const name = (params.get('name') ?? '').trim()
  const phone = normalisePhone(params.get('phone') ?? '')
  const branch = (params.get('branch') ?? '').trim()
  const modality = params.get('modality')
  return {
    branch: /^[a-z0-9-]{1,80}$/.test(branch) ? branch : null,
    name: name.length >= 2 && name.length <= 120 && NAME_PATTERN.test(name) ? name : null,
    phone: PHONE_PATTERN.test(phone) ? phone : null,
    modality: isModality(modality) ? modality : null,
  }
}

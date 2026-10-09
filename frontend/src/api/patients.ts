import { api } from './client'

export interface PatientMatch {
  id: string
  full_name: string
  phone: string | null
}

export interface PatientLookupResponse {
  patients: PatientMatch[]
}

export const patientsApi = {
  lookup: (q: string, signal?: AbortSignal) => api.get<PatientLookupResponse>(`/patients/lookup?q=${encodeURIComponent(q)}`, { signal }),
}

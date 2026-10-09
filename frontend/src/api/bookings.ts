import type {
  AppointmentListResponse,
  AppointmentResponse,
  AppointmentScope,
  AvailabilityResponse,
  ChecklistResponse,
  CreateAppointmentRequest,
  DaysResponse,
  NextAvailableResponse,
  StaffAppointmentFilters,
  StatusUpdate,
} from '../types/booking'
import { API_BASE_URL, api } from './client'

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value))
    }
  }
  const text = search.toString()
  return text === '' ? '' : `?${text}`
}

export const bookingsApi = {
  availability: (branchId: string, scanTypeId: string, date: string, signal?: AbortSignal) =>
    api.get<AvailabilityResponse>(`/booking/availability${query({ branch_id: branchId, scan_type_id: scanTypeId, date })}`, { signal }),
  days: (branchId: string, scanTypeId: string, from?: string, days?: number, signal?: AbortSignal) =>
    api.get<DaysResponse>(`/booking/days${query({ branch_id: branchId, scan_type_id: scanTypeId, from, days })}`, { signal }),
  nextAvailable: (scanTypeId: string, excludeBranchId?: string, after?: string) =>
    api.get<NextAvailableResponse>(`/booking/next-available${query({ scan_type_id: scanTypeId, exclude_branch_id: excludeBranchId, after })}`),
  checklist: (scanTypeId: string) => api.get<ChecklistResponse>(`/scan-types/${encodeURIComponent(scanTypeId)}/checklist`),
  create: (payload: CreateAppointmentRequest) => api.post<AppointmentResponse>('/appointments', payload),
  list: (scope: AppointmentScope = 'all') => api.get<AppointmentListResponse>(`/appointments${query({ scope })}`),
  listForStaff: (filters: StaffAppointmentFilters) => api.get<AppointmentListResponse>(`/appointments${query({ ...filters })}`),
  get: (id: string) => api.get<AppointmentResponse>(`/appointments/${encodeURIComponent(id)}`),
  reschedule: (id: string, slotId: string) =>
    api.patch<AppointmentResponse>(`/appointments/${encodeURIComponent(id)}/reschedule`, { slot_id: slotId }),
  cancel: (id: string, reason?: string) =>
    api.patch<AppointmentResponse>(`/appointments/${encodeURIComponent(id)}/cancel`, reason ? { reason } : {}),
  updateStatus: (id: string, update: StatusUpdate) =>
    api.patch<AppointmentResponse>(`/appointments/${encodeURIComponent(id)}/status`, update),
  icsUrl: (id: string) => `${API_BASE_URL}/appointments/${encodeURIComponent(id)}/ics`,
}

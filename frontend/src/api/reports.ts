import type {
  ReportListFilters,
  ReportResponse,
  ReportsResponse,
  StaffAppointmentsResponse,
  UpdateReportInput,
  UploadReportInput,
} from '../types/report'
import { API_BASE_URL, api } from './client'

function query(filters: ReportListFilters): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value))
    }
  }
  const text = params.toString()
  return text === '' ? '' : `?${text}`
}

export function buildUploadForm(input: UploadReportInput): FormData {
  const form = new FormData()
  form.set('appointment_id', input.appointment_id)
  form.set('title', input.title)
  form.set('status', input.status)
  if (input.notes !== '') {
    form.set('notes', input.notes)
  }
  if (input.impression !== '') {
    form.set('impression', input.impression)
  }
  form.set('file', input.file)
  return form
}

export const reportsApi = {
  list: (filters: ReportListFilters = {}) => api.get<ReportsResponse>(`/reports${query({ per_page: 100, ...filters })}`),
  get: (id: string) => api.get<ReportResponse>(`/reports/${encodeURIComponent(id)}`),
  upload: (input: UploadReportInput) => api.post<ReportResponse>('/reports', buildUploadForm(input)),
  update: (id: string, input: UpdateReportInput) => api.patch<ReportResponse>(`/reports/${encodeURIComponent(id)}`, input),
  remove: (id: string) => api.delete<void>(`/reports/${encodeURIComponent(id)}`),
  downloadUrl: (id: string) => `${API_BASE_URL}/reports/${encodeURIComponent(id)}/download`,
  staffAppointments: () => api.get<StaffAppointmentsResponse>('/appointments?scope=all&per_page=100'),
}

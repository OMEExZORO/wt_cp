import type {
  AcknowledgeResponse,
  AlertEventsResponse,
  DoctorQueueResponse,
  FlagCriticalResponse,
  MyAlertsResponse,
  ResolveResponse,
  StaffAlertsResponse,
} from '../types/alerts'
import { api } from './client'

export interface StaffAlertFilters {
  status?: string
  flagged?: boolean
  q?: string
}

export const alertsApi = {
  mine: () => api.get<MyAlertsResponse>('/alerts/mine'),
  acknowledge: (id: string) => api.post<AcknowledgeResponse>(`/alerts/${id}/acknowledge`),
  list: (filters: StaffAlertFilters = {}) => {
    const params = new URLSearchParams()
    if (filters.status !== undefined && filters.status !== '') params.set('status', filters.status)
    if (filters.flagged === true) params.set('flagged', '1')
    if (filters.q !== undefined && filters.q.trim() !== '') params.set('q', filters.q.trim())
    const query = params.toString()
    return api.get<StaffAlertsResponse>(query === '' ? '/alerts' : `/alerts?${query}`)
  },
  events: (id: string) => api.get<AlertEventsResponse>(`/alerts/${id}/events`),
  resolve: (id: string, note: string) => api.patch<ResolveResponse>(`/alerts/${id}/resolve`, { note }),
  flagCritical: (reportId: string, note?: string) =>
    api.post<FlagCriticalResponse>(`/reports/${reportId}/critical`, note === undefined || note === '' ? {} : { note }),
  doctorQueue: () => api.get<DoctorQueueResponse>('/doctor/queue'),
}

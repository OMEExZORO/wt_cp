import type {
  CreateReferralRequest,
  ReferralResponse,
  ReferralsResponse,
  ReferralStatus,
  UpdateReferralRequest,
} from '../types/referral'
import { api } from './client'

export const referralsApi = {
  list: (filters: { status?: ReferralStatus; q?: string } = {}) => {
    const params = new URLSearchParams({ per_page: '100' })
    if (filters.status !== undefined) {
      params.set('status', filters.status)
    }
    if (filters.q !== undefined && filters.q !== '') {
      params.set('q', filters.q)
    }
    return api.get<ReferralsResponse>(`/referrals?${params.toString()}`)
  },
  get: (id: string) => api.get<ReferralResponse>(`/referrals/${encodeURIComponent(id)}`),
  create: (payload: CreateReferralRequest) => api.post<ReferralResponse>('/referrals', payload),
  update: (id: string, payload: UpdateReferralRequest) => api.patch<ReferralResponse>(`/referrals/${encodeURIComponent(id)}`, payload),
}

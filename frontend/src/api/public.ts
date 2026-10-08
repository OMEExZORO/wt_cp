import type {
  BranchesResponse,
  DoctorResponse,
  FaqsResponse,
  Modality,
  ReviewsResponse,
  ScanCategoriesResponse,
  ScanTypeResponse,
  ScanTypesResponse,
  SiteSettingsResponse,
} from '../types/public'
import { api } from './client'

export const publicApi = {
  site: () => api.get<SiteSettingsResponse>('/public/site'),
  doctor: () => api.get<DoctorResponse>('/public/doctor'),
  branches: () => api.get<BranchesResponse>('/public/branches'),
  scanCategories: (modality?: Modality) =>
    api.get<ScanCategoriesResponse>(`/public/scan-categories${modality ? `?modality=${modality}` : ''}`),
  scanTypes: (filters: { modality?: Modality; q?: string } = {}) => {
    const params = new URLSearchParams()
    if (filters.modality) {
      params.set('modality', filters.modality)
    }
    if (filters.q) {
      params.set('q', filters.q)
    }
    const query = params.toString()
    return api.get<ScanTypesResponse>(`/public/scan-types${query ? `?${query}` : ''}`)
  },
  scanType: (ref: string) => api.get<ScanTypeResponse>(`/public/scan-types/${encodeURIComponent(ref)}`),
  faqs: () => api.get<FaqsResponse>('/public/faqs'),
  reviews: (limit = 12) => api.get<ReviewsResponse>(`/public/reviews?limit=${limit}`),
}

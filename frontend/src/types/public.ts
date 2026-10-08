export type Modality = 'USG' | 'CT' | 'BIOPSY'

export interface SettingEntry {
  value: unknown
  type: string
  group: string
  label: string
  is_placeholder: boolean
}

export type SettingsMap = Record<string, SettingEntry>

export interface SiteSettingsResponse {
  settings: SettingsMap
}

export interface DoctorResponse {
  doctor: Record<string, SettingEntry>
}

export interface PublicBranch {
  id: string
  slug: string
  name: string
  address_line: string
  landmark: string | null
  area: string | null
  city: string
  state: string
  postal_code: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  opening_hours: string | null
  maps_url: string | null
  maps_embed_url: string | null
  latitude: number | null
  longitude: number | null
  address_is_placeholder: boolean
  is_placeholder: boolean
}

export interface BranchesResponse {
  branches: PublicBranch[]
}

export interface PublicScanCategory {
  id: string
  slug: string
  modality: Modality
  name: string
  tagline: string | null
  description: string | null
  parent_slug: string | null
  scan_count: number
}

export interface ScanCategoriesResponse {
  categories: PublicScanCategory[]
}

export interface PublicScanType {
  id: string
  slug: string
  modality: Modality
  name: string
  short_description: string
  preparation_tips: string
  is_bookable_online: boolean
  category: { slug: string; name: string }
  group: { slug: string; name: string } | null
}

export interface ScanTypesResponse {
  scan_types: PublicScanType[]
}

export interface ScanTypeResponse {
  scan_type: PublicScanType
}

export type FaqCategory = 'general' | 'booking' | 'preparation' | 'reports' | 'privacy'

export interface PublicFaq {
  id: string
  question: string
  answer: string
  category: FaqCategory
  sort_order: number
}

export interface FaqsResponse {
  faqs: PublicFaq[]
}

export interface PublicReview {
  id: string
  display_name: string
  rating: number
  body: string
  verified_visit: boolean
  created_at: string | null
  is_demo?: boolean
}

export interface ReviewSummary {
  count: number
  average_rating: number | null
}

export interface ReviewsResponse {
  reviews: PublicReview[]
  summary: ReviewSummary
}

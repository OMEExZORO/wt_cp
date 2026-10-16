import { toIso } from '../core/time.js'
import { flag } from '../models/flag.js'

const text = (value) => (value === null || value === undefined || value === '' ? null : String(value))

const asList = (map) => (Object.keys(map).length === 0 ? [] : map)

export const castSetting = (type, value) => {
  if (type === 'json') {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  return value
}

export const presentSettings = (rows) => {
  const settings = {}
  for (const row of rows) {
    const placeholder = flag(row.is_placeholder)
    const type = String(row.value_type)
    const empty = placeholder || row.value === null || row.value === undefined || row.value === ''
    settings[String(row.key)] = {
      value: empty ? null : castSetting(type, String(row.value)),
      type,
      group: String(row.group_name),
      label: String(row.label),
      is_placeholder: placeholder,
    }
  }
  return asList(settings)
}

export const presentDoctor = (settings) => {
  const profile = {}
  for (const [key, setting] of Object.entries(settings)) {
    if (key.startsWith('doctor.')) profile[key.slice(7)] = setting
  }
  return asList(profile)
}

export const presentBranch = (row) => {
  const address = String(row.address_line)
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    address_line: address,
    landmark: text(row.landmark),
    area: text(row.area),
    city: row.city,
    state: row.state,
    postal_code: text(row.postal_code),
    phone: text(row.phone),
    phone_secondary: text(row.phone_secondary),
    whatsapp: text(row.whatsapp),
    email: text(row.email),
    opening_hours: text(row.opening_hours),
    maps_url: text(row.maps_url),
    maps_embed_url: text(row.maps_embed_url),
    latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
    address_is_placeholder: address.startsWith('TODO'),
    is_placeholder: flag(row.is_placeholder),
  }
}

export const presentScanType = (row) => ({
  id: row.id,
  slug: row.slug,
  modality: row.modality,
  name: row.name,
  short_description: row.short_description,
  preparation_tips: row.preparation_tips,
  is_bookable_online: flag(row.is_bookable_online),
  category: { slug: row.category_slug, name: row.category_name },
  group: row.group_slug === null || row.group_slug === undefined ? null : { slug: row.group_slug, name: row.group_name },
})

export const presentReview = (row, exposeDemoFlag, timezone = 'Asia/Kolkata') => {
  const review = {
    id: row.id,
    display_name: row.display_name,
    rating: Number.parseInt(row.rating, 10) || 0,
    body: row.body,
    verified_visit: flag(row.verified_visit),
    created_at: toIso(row.created_at, timezone),
    source: row.source ?? 'site',
    source_url: row.source_url ?? null,
    external_review_date: row.external_review_date ?? null,
    translated_by_google: Boolean(row.translated_by_google ?? false),
    reviewer_photo_url: row.reviewer_photo_url ?? null,
  }
  if (exposeDemoFlag) review.is_demo = flag(row.is_demo)
  return review
}

export const presentReviewSummary = (stats) => {
  const count = Number.parseInt(stats.review_count, 10) || 0
  const average = stats.average_rating === null || stats.average_rating === undefined ? null : Number(stats.average_rating)
  return {
    count,
    average_rating: count === 0 || average === null ? null : Math.round(average * 10) / 10,
  }
}

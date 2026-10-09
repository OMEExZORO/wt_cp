import type { PublicBranch, SettingEntry } from '../types/public'

export function settingText(entry: SettingEntry | undefined): string | null {
  return typeof entry?.value === 'string' && entry.value.trim() !== '' ? entry.value : null
}

export function settingList(entry: SettingEntry | undefined): string[] {
  return Array.isArray(entry?.value) ? (entry.value as unknown[]).filter((item): item is string => typeof item === 'string') : []
}

function digits(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function telHref(phone: string): string {
  const number = digits(phone)
  return number.length === 10 ? `tel:+91${number}` : `tel:+${number}`
}

export function whatsappHref(phone: string): string {
  const number = digits(phone)
  return `https://wa.me/${number.length === 10 ? `91${number}` : number}`
}

export function branchAddress(branch: PublicBranch): string {
  const cityLine = `${branch.city} ${branch.postal_code ?? ''}`.trim()
  const parts = [branch.address_line, branch.area, cityLine, branch.state]
  return parts.filter((part): part is string => typeof part === 'string' && part.trim() !== '').join(', ')
}

export function mapsEmbedUrl(branch: PublicBranch): string | null {
  if (branch.address_is_placeholder) {
    return null
  }
  if (branch.maps_embed_url) {
    return branch.maps_embed_url
  }
  return `https://www.google.com/maps?q=${encodeURIComponent(`${branch.name}, ${branchAddress(branch)}`)}&output=embed`
}

export function directionsUrl(branch: PublicBranch): string | null {
  if (branch.address_is_placeholder) {
    return null
  }
  if (branch.maps_url) {
    return branch.maps_url
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(branchAddress(branch))}`
}

export function formatPhone(phone: string): string {
  const number = digits(phone)
  return number.length === 10 ? `0${number.slice(0, 5)} ${number.slice(5)}` : phone
}

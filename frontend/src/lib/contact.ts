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

export function toE164(phone: string): string {
  const number = digits(phone)
  return number.length === 10 ? `+91${number}` : `+${number}`
}

export function whatsappHref(phone: string): string {
  const number = digits(phone)
  return `https://wa.me/${number.length === 10 ? `91${number}` : number}`
}

export function formatPostalCode(postalCode: string): string {
  return /^\d{6}$/.test(postalCode) ? `${postalCode.slice(0, 3)} ${postalCode.slice(3)}` : postalCode
}

export function branchAddress(branch: PublicBranch): string {
  const postal = branch.postal_code ? ` - ${formatPostalCode(branch.postal_code)}` : ''
  return `${branch.address_line}${postal}`
}

export function branchPhones(branch: Pick<PublicBranch, 'phone' | 'phone_secondary'>): string[] {
  return [branch.phone, branch.phone_secondary].filter((phone): phone is string => typeof phone === 'string' && phone.trim() !== '')
}

export function directionsUrl(branch: PublicBranch): string | null {
  if (branch.address_is_placeholder) {
    return null
  }
  return branch.maps_url ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branchAddress(branch))}`
}

export function formatPhone(phone: string): string {
  const number = digits(phone)
  const local = number.length === 12 && number.startsWith('91') ? number.slice(2) : number
  return local.length === 10 ? `+91 ${local.slice(0, 5)} ${local.slice(5)}` : phone
}

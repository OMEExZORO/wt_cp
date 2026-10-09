import { useAppSelector } from '../app/hooks'
import { selectSetting } from '../features/public/publicSlice'
import { settingText } from './contact'

export interface CentreContact {
  id: string
  label: string
  phone: string | null
  whatsapp: string | null
}

export interface ContactInfo {
  centres: CentreContact[]
  phone: string | null
  whatsapp: string | null
  email: string | null
  primaryPhone: string | null
  primaryWhatsapp: string | null
  hasAny: boolean
}

export function useContactInfo(): ContactInfo {
  const branches = useAppSelector((state) => state.public.branches.data?.branches ?? [])
  const phone = settingText(useAppSelector(selectSetting('contact.phone')))
  const whatsapp = settingText(useAppSelector(selectSetting('contact.whatsapp')))
  const siteEmail = settingText(useAppSelector(selectSetting('contact.email')))

  const centres: CentreContact[] = branches
    .filter((branch) => !branch.address_is_placeholder && (branch.phone !== null || branch.whatsapp !== null))
    .map((branch) => ({ id: branch.id, label: branch.area ?? branch.name, phone: branch.phone, whatsapp: branch.whatsapp }))
  const branchEmail = branches.find((branch) => !branch.address_is_placeholder && branch.email !== null)?.email ?? null
  const email = siteEmail ?? branchEmail
  const primaryPhone = centres.find((centre) => centre.phone !== null)?.phone ?? phone
  const primaryWhatsapp = centres.find((centre) => centre.whatsapp !== null)?.whatsapp ?? whatsapp

  return {
    centres,
    phone,
    whatsapp,
    email,
    primaryPhone,
    primaryWhatsapp,
    hasAny: centres.length > 0 || phone !== null || whatsapp !== null || email !== null,
  }
}

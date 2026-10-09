import { useAppSelector } from '../../app/hooks'
import { selectSetting } from '../../features/public/publicSlice'
import { branchAddress, settingText } from '../../lib/contact'
import { useJsonLd } from '../../lib/seo'

export function StructuredData() {
  const branches = useAppSelector((state) => state.public.branches.data?.branches ?? [])
  const phone = settingText(useAppSelector(selectSetting('contact.phone')))
  const primary = branches.find((branch) => !branch.address_is_placeholder)

  const business: Record<string, unknown> | null =
    primary === undefined
      ? null
      : {
          '@context': 'https://schema.org',
          '@type': 'MedicalBusiness',
          name: 'Meghnad Diagnostic Centre',
          logo: `${window.location.origin}/images/client/logo-lockup.png`,
          image: `${window.location.origin}/images/client/logo-lockup.png`,
          alternateName: 'MDC',
          slogan: 'Imaging for a Healthier Tomorrow',
          medicalSpecialty: 'Radiography',
          address: {
            '@type': 'PostalAddress',
            streetAddress: primary.address_line,
            addressLocality: primary.area ?? primary.city,
            addressRegion: primary.state,
            ...(primary.postal_code ? { postalCode: primary.postal_code } : {}),
            addressCountry: 'IN',
          },
          ...(phone ? { telephone: phone } : {}),
          ...(primary.opening_hours ? { openingHours: primary.opening_hours } : {}),
          description: `Ultrasound, CT and image-guided biopsies at ${branchAddress(primary)}.`,
        }

  const physician: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Physician',
    name: 'Dr. Meghnad Padsalgikar',
    jobTitle: 'Radiologist',
    medicalSpecialty: 'Radiography',
    hasCredential: ['MBBS', 'DMRE', 'DNB (Radiology)'].map((name) => ({
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: 'degree',
      name,
    })),
    worksFor: { '@type': 'MedicalBusiness', name: 'Meghnad Diagnostic Centre' },
    affiliation: { '@type': 'Hospital', name: 'Sabale Hospital, Bhosari' },
  }

  useJsonLd('ld-medical-business', business)
  useJsonLd('ld-physician', physician)
  return null
}

import { useAppSelector } from '../../app/hooks'
import { selectBranches } from '../../features/public/publicSlice'
import { branchAddress, branchPhones, directionsUrl, toE164 } from '../../lib/contact'
import { useJsonLd } from '../../lib/seo'

export function StructuredData() {
  const branches = useAppSelector(selectBranches)
  const centres = branches.filter((branch) => !branch.address_is_placeholder)

  const origin = window.location.origin
  const business: Record<string, unknown> | null =
    centres.length === 0
      ? null
      : {
          '@context': 'https://schema.org',
          '@graph': centres.map((branch, index) => ({
            '@type': 'MedicalBusiness',
            '@id': `${origin}/branches#${branch.slug}`,
            name: `Meghnad Diagnostic Centre, ${branch.area ?? branch.name}`,
            ...(index === 0 ? {} : { parentOrganization: { '@id': `${origin}/branches#${centres[0].slug}` } }),
            logo: `${origin}/images/client/logo-lockup.png`,
            image: `${origin}/images/client/logo-lockup.png`,
            alternateName: 'MDC',
            slogan: 'Imaging for a Healthier Tomorrow',
            medicalSpecialty: 'Radiography',
            address: {
              '@type': 'PostalAddress',
              streetAddress: branch.address_line,
              addressLocality: branch.city,
              addressRegion: branch.state,
              ...(branch.postal_code ? { postalCode: branch.postal_code } : {}),
              addressCountry: 'IN',
            },
            ...(directionsUrl(branch) ? { hasMap: directionsUrl(branch) } : {}),
            ...(branchPhones(branch).length > 0 ? { telephone: branchPhones(branch).map(toE164) } : {}),
            openingHoursSpecification: [
              {
                '@type': 'OpeningHoursSpecification',
                dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                opens: '08:00',
                closes: '22:00',
              },
            ],
            description: `Ultrasound, CT and image-guided biopsies at ${branchAddress(branch)}. 24 Hours Lab Service.`,
          })),
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

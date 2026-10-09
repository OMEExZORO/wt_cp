export interface SiteImage {
  src: string
  alt: string
  width: number
  height: number
}

export type ImageKey =
  | 'hero-welcome'
  | 'hero-ct'
  | 'hero-ultrasound'
  | 'hero-biopsy'
  | 'card-ct'
  | 'card-ultrasound'
  | 'card-biopsy'
  | 'card-reporting'
  | 'card-reception'

export const CLIENT_OVERRIDES: Partial<Record<ImageKey, string>> = {}

const STOCK = '/images/stock'

const BASE: Record<ImageKey, SiteImage> = {
  'hero-welcome': { src: `${STOCK}/hero-welcome.webp`, alt: 'Bright, quiet waiting area of a diagnostic centre', width: 1600, height: 900 },
  'hero-ct': { src: `${STOCK}/hero-ct.webp`, alt: 'CT scanner with its examination table in a clean scan room', width: 1600, height: 900 },
  'hero-ultrasound': { src: `${STOCK}/hero-ultrasound.webp`, alt: 'Sonographer operating an ultrasound machine during an examination', width: 1600, height: 900 },
  'hero-biopsy': { src: `${STOCK}/hero-biopsy.webp`, alt: 'Gloved hands performing an ultrasound-guided needle procedure', width: 1600, height: 900 },
  'card-ct': { src: `${STOCK}/card-ct.webp`, alt: 'CT scanner and table in a scan room', width: 800, height: 600 },
  'card-ultrasound': { src: `${STOCK}/card-ultrasound.webp`, alt: 'Doctor seated beside an ultrasound machine', width: 800, height: 600 },
  'card-biopsy': { src: `${STOCK}/card-biopsy.webp`, alt: 'Gloved hand holding a sterile biopsy needle', width: 800, height: 600 },
  'card-reporting': { src: `${STOCK}/card-reporting.webp`, alt: 'Doctor pointing at an X-ray and MRI scans on a light box', width: 800, height: 600 },
  'card-reception': { src: `${STOCK}/card-reception.webp`, alt: 'Reception desk of a modern clinic', width: 800, height: 600 },
}

export function siteImage(key: ImageKey): SiteImage {
  const override = CLIENT_OVERRIDES[key]
  return override ? { ...BASE[key], src: override } : BASE[key]
}

import { Link } from 'react-router-dom'
import { telHref } from '../../lib/contact'
import { siteImage, type ImageKey } from '../../lib/images'
import { useContactInfo } from '../../lib/useContactInfo'
import { ArrowRightIcon, CheckIcon, NeedleIcon, PhoneIcon, ScanRingIcon, WaveIcon } from '../icons/Icons'
import { Todo } from '../public/Primitives'
import type { ReactNode } from 'react'

interface Modality {
  id: string
  type: 'USG' | 'CT' | 'BIOPSY'
  title: string
  tagline: string
  text: string
  scans: string[]
  image: ImageKey
  icon: ReactNode
}

export const MODALITIES: Modality[] = [
  {
    id: 'ultrasound',
    type: 'USG',
    title: 'Ultrasound (USG)',
    tagline: 'Safe, non-invasive, highly accurate',
    text: 'Real-time imaging with sound waves for obstetrics, gynaecology, the abdomen, small parts, blood flow and the prostate.',
    scans: ['Obstetric scans and Doppler', 'Pelvic and transvaginal USG', 'Whole abdomen and renal tract', 'Thyroid and breast', 'Vascular Doppler', 'Prostate (TRUS)'],
    image: 'card-ultrasound',
    icon: <WaveIcon size={22} />,
  },
  {
    id: 'ct',
    type: 'CT',
    title: 'Computed Tomography (CT)',
    tagline: 'Detailed, fast, low-dose technology',
    text: 'Cross-sectional imaging of the head, chest, abdomen, spine and joints, reported by an experienced radiologist.',
    scans: ['CT brain and CT PNS', 'HRCT chest and CT thorax', 'CT abdomen and pelvis', 'CT KUB and CT urography', 'CT spine', 'CT-guided procedures'],
    image: 'card-ct',
    icon: <ScanRingIcon size={22} />,
  },
  {
    id: 'biopsy',
    type: 'BIOPSY',
    title: 'Image-guided biopsies',
    tagline: 'Precise, safe, minimally invasive',
    text: 'Ultrasound and CT guided sampling and drainage, so the needle is placed exactly where it is needed.',
    scans: ['FNAC and core needle biopsy', 'Breast and liver biopsy', 'Kidney and lymph node biopsy', 'Prostate (TRUS guided)', 'Soft tissue and musculoskeletal', 'Drainage and aspiration'],
    image: 'card-biopsy',
    icon: <NeedleIcon size={22} />,
  },
]

export function ModalityShowcase() {
  const { primaryPhone } = useContactInfo()
  return (
    <div className="modality-list">
      {MODALITIES.map((modality, position) => {
        const image = siteImage(modality.image)
        return (
          <article key={modality.id} className={`modality${position % 2 === 1 ? ' modality--flip' : ''}`} aria-labelledby={`modality-${modality.id}`}>
            <div className="modality__media">
              <img src={image.src} alt={image.alt} width={image.width} height={image.height} loading="lazy" decoding="async" />
            </div>
            <div className="modality__body">
              <p className="modality__tag">
                {modality.icon} {modality.tagline}
              </p>
              <h3 id={`modality-${modality.id}`} className="modality__title">
                {modality.title}
              </h3>
              <p>{modality.text}</p>
              <ul className="modality__scans" aria-label={`Key ${modality.title} scans`}>
                {modality.scans.map((scan) => (
                  <li key={scan}>
                    <CheckIcon size={16} /> {scan}
                  </li>
                ))}
              </ul>
              <div className="modality__actions">
                <Link to={`/services?type=${modality.type}`} className="btn btn--primary" aria-label={`View details of ${modality.title}`}>
                  View details <ArrowRightIcon size={16} />
                </Link>
                {primaryPhone ? (
                  <a href={telHref(primaryPhone)} className="btn btn--outline" aria-label={`Call us now about ${modality.title}`}>
                    <PhoneIcon size={16} /> Call us now
                  </a>
                ) : (
                  <Todo label="phone" />
                )}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

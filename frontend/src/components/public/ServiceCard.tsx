import { memo } from 'react'
import { Link } from 'react-router-dom'
import type { Modality, PublicScanType } from '../../types/public'
import { ArrowRightIcon } from '../icons/Icons'

export const MODALITY_LABEL: Record<Modality, string> = {
  USG: 'Ultrasound',
  CT: 'CT',
  BIOPSY: 'Biopsy',
}

export const MODALITY_TONE: Record<Modality, string> = {
  USG: 'teal',
  CT: 'lavender',
  BIOPSY: 'peach',
}

function ServiceCardBase({ scan, headingLevel = 3 }: { scan: PublicScanType; headingLevel?: 3 | 4 }) {
  const Heading = headingLevel === 3 ? 'h3' : 'h4'
  return (
    <li className={`service-card service-card--${MODALITY_TONE[scan.modality]}`}>
      <div className="service-card__top">
        <span className="service-card__modality">{MODALITY_LABEL[scan.modality]}</span>
        <Heading className="service-card__title">{scan.name}</Heading>
        <p className="service-card__desc">{scan.short_description}</p>
      </div>
      <details className="service-card__prep">
        <summary>Preparation tips</summary>
        <p>{scan.preparation_tips}</p>
      </details>
      <Link to={`/services/${scan.slug}`} className="service-card__link">
        Scan details <ArrowRightIcon size={16} />
      </Link>
    </li>
  )
}

export const ServiceCard = memo(ServiceCardBase)

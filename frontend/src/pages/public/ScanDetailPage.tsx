import { Link, useParams } from 'react-router-dom'
import { publicApi } from '../../api/public'
import { CtaBand } from '../../components/public/Blocks'
import { ArrowRightIcon, InfoIcon } from '../../components/icons/Icons'
import { MODALITY_LABEL, MODALITY_TONE } from '../../components/public/ServiceCard'
import { useApiQuery } from '../../hooks/useApi'
import { usePageMeta } from '../../lib/seo'

export default function ScanDetailPage() {
  const { slug = '' } = useParams()
  const { data, error, loading, reload } = useApiQuery(() => publicApi.scanType(slug), [slug])
  const scan = data?.scan_type ?? null
  usePageMeta(scan ? scan.name : 'Scan details', scan ? `${scan.name} at Meghnad Diagnostic Centre. ${scan.short_description}` : 'Scan details at Meghnad Diagnostic Centre.')

  if (loading || (data === null && error === null)) {
    return (
      <div className="container section" role="status">
        Loading scan details…
      </div>
    )
  }
  if (error !== null || scan === null) {
    return (
      <div className="container section">
        <h1>{error?.status === 404 ? 'Scan not found' : 'Could not load this scan'}</h1>
        <p>{error?.status === 404 ? 'This scan is not on our list.' : error?.message}</p>
        <p>
          {error?.status === 404 ? null : (
            <button type="button" className="btn btn--outline" onClick={() => void reload()}>
              Try again
            </button>
          )}{' '}
          <Link to="/services" className="text-link">
            Back to all services
          </Link>
        </p>
      </div>
    )
  }

  return (
    <>
      <div className={`page-hero page-hero--${MODALITY_TONE[scan.modality]}`}>
        <div className="container">
          <nav aria-label="Breadcrumb" className="breadcrumb">
            <Link to="/services">Services</Link>
            <span aria-hidden="true"> / </span>
            <span>{MODALITY_LABEL[scan.modality]}</span>
          </nav>
          <p className="eyebrow">{scan.group ? `${scan.group.name} · ${scan.category.name}` : scan.category.name}</p>
          <h1 className="section-heading__title">{scan.name}</h1>
          <p className="section-heading__intro">{scan.short_description}</p>
        </div>
      </div>
      <section className="section">
        <div className="container container--narrow">
          <h2>How to prepare</h2>
          <p className="prose-lead">{scan.preparation_tips}</p>
          <p className="callout">
            <InfoIcon size={20} />
            <span>These are general tips. Your doctor or the centre may give you different instructions for your situation, and you will answer a short safety checklist when you book.</span>
          </p>
          <div className="detail-actions">
            <Link to="/book" className="btn btn--primary btn--lg">
              Book an appointment
            </Link>
            <Link to="/services" className="text-link">
              All services <ArrowRightIcon size={16} />
            </Link>
          </div>
        </div>
      </section>
      <CtaBand />
    </>
  )
}

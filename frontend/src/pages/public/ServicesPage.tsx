import { useCallback, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHero } from '../../components/public/Blocks'
import { AsyncState, FilterChips } from '../../components/public/Primitives'
import { MODALITY_LABEL, ServiceCard } from '../../components/public/ServiceCard'
import { usePublicResource } from '../../hooks/usePublicResource'
import { usePageMeta } from '../../lib/seo'
import type { Modality, PublicScanType } from '../../types/public'

type Filter = 'ALL' | Modality

const OPTIONS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'USG', label: 'Ultrasound (USG)' },
  { value: 'CT', label: 'CT' },
  { value: 'BIOPSY', label: 'Biopsy' },
]

export function filterScans(scans: PublicScanType[], modality: Filter, query: string): PublicScanType[] {
  const needle = query.trim().toLowerCase()
  return scans.filter((scan) => {
    if (modality !== 'ALL' && scan.modality !== modality) {
      return false
    }
    if (needle === '') {
      return true
    }
    return (
      scan.name.toLowerCase().includes(needle) ||
      scan.short_description.toLowerCase().includes(needle) ||
      scan.category.name.toLowerCase().includes(needle)
    )
  })
}

interface Section {
  key: string
  title: string
  sub: { key: string; title: string | null; scans: PublicScanType[] }[]
}

export function groupScans(scans: PublicScanType[]): Section[] {
  const sections: Section[] = []
  for (const scan of scans) {
    const top = scan.group ?? scan.category
    let section = sections.find((item) => item.key === top.slug)
    if (section === undefined) {
      section = { key: top.slug, title: top.name, sub: [] }
      sections.push(section)
    }
    const subKey = scan.group ? scan.category.slug : 'all'
    let sub = section.sub.find((item) => item.key === subKey)
    if (sub === undefined) {
      sub = { key: subKey, title: scan.group ? scan.category.name : null, scans: [] }
      section.sub.push(sub)
    }
    sub.scans.push(scan)
  }
  return sections
}

function initialFilter(value: string | null): Filter {
  return value === 'USG' || value === 'CT' || value === 'BIOPSY' ? value : 'ALL'
}

export default function ServicesPage() {
  usePageMeta('Services', 'Ultrasound, CT and image-guided biopsy services at Meghnad Diagnostic Centre, with plain-language descriptions and preparation tips for each scan.')
  const [params] = useSearchParams()
  const [modality, setModality] = useState<Filter>(() => initialFilter(params.get('type')))
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const { data, status, error, reload } = usePublicResource('scanTypes')

  const filtered = useMemo(() => filterScans(data?.scan_types ?? [], modality, query), [data, modality, query])
  const sections = useMemo(() => groupScans(filtered), [filtered])

  const onSearch = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value)
  }, [])

  const clear = useCallback(() => {
    setQuery('')
    setModality('ALL')
    searchRef.current?.focus()
  }, [])

  return (
    <>
      <PageHero eyebrow="Services" title="Scans and procedures" intro="Search or filter to find a scan. Each one has a plain-language description and tips to prepare. Your own doctor or the centre may give different instructions, so follow those first." />
      <div className="container">
        <p>
          <a className="text-link" href="/images/client/brochure-services.jpg" target="_blank" rel="noopener noreferrer">
            View our services brochure
          </a>
        </p>
      </div>
      <section className="section section--flush" aria-label="Browse services">
        <div className="container">
          <div className="toolbar">
            <div className="search">
              <label htmlFor="scan-search" className="search__label">
                Search scans
              </label>
              <input
                id="scan-search"
                ref={searchRef}
                type="search"
                className="search__input"
                placeholder="For example: abdomen, thyroid, CT brain"
                value={query}
                onChange={onSearch}
                maxLength={80}
                autoComplete="off"
              />
            </div>
            <FilterChips label="Filter by type" options={OPTIONS} value={modality} onChange={setModality} />
          </div>
          <AsyncState status={status} error={error} onRetry={reload} label="Loading scans">
            <p className="results-count" role="status" aria-live="polite">
              Showing {filtered.length} {filtered.length === 1 ? 'scan' : 'scans'}
              {modality !== 'ALL' ? ` in ${MODALITY_LABEL[modality]}` : ''}
            </p>
            {filtered.length === 0 ? (
              <div className="state-card">
                <p>No scans match your search.</p>
                <button type="button" className="btn btn--outline" onClick={clear}>
                  Clear search and filters
                </button>
              </div>
            ) : (
              sections.map((section) => (
                <section key={section.key} className="scan-section" aria-labelledby={`sec-${section.key}`}>
                  <h2 id={`sec-${section.key}`} className="scan-section__title">
                    {section.title}
                  </h2>
                  {section.sub.map((sub) => (
                    <div key={sub.key} className="scan-group">
                      {sub.title ? <h3 className="scan-group__title">{sub.title}</h3> : null}
                      <ul className="card-grid">
                        {sub.scans.map((scan) => (
                          <ServiceCard key={scan.id} scan={scan} headingLevel={sub.title ? 4 : 3} />
                        ))}
                      </ul>
                    </div>
                  ))}
                </section>
              ))
            )}
          </AsyncState>
        </div>
      </section>
    </>
  )
}

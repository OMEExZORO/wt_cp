import { BranchCard } from '../../components/public/BranchCard'
import { CtaBand, PageHero } from '../../components/public/Blocks'
import { AsyncState } from '../../components/public/Primitives'
import { usePublicResource } from '../../hooks/usePublicResource'
import { usePageMeta } from '../../lib/seo'

export default function BranchesPage() {
  usePageMeta('Branches', 'Meghnad Diagnostic Centre branches at Bhosari, Moshi, Pimple Gurav and Moi, Pune: address, phone numbers, timings and Google Maps. 24 Hours Lab Service.')
  const { data, status, error, reload } = usePublicResource('branches')
  return (
    <>
      <PageHero eyebrow="Location" title="Our branches" intro="Meghnad Diagnostic Centre at Bhosari, Moshi, Pimple Gurav and Moi. 24 Hours Lab Service." />
      <section className="section section--flush">
        <div className="container">
          <AsyncState status={status} error={error} onRetry={reload} label="Loading branches">
            <div className="stack">
              {(data?.branches ?? []).map((branch) => (
                <BranchCard key={branch.id} branch={branch} headingLevel={2} />
              ))}
            </div>
          </AsyncState>
        </div>
      </section>
      <CtaBand />
    </>
  )
}

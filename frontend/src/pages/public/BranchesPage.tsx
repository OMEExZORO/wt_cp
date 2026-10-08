import { BranchCard } from '../../components/public/BranchCard'
import { CtaBand, PageHero } from '../../components/public/Blocks'
import { AsyncState } from '../../components/public/Primitives'
import { usePublicResource } from '../../hooks/usePublicResource'
import { usePageMeta } from '../../lib/seo'

export default function BranchesPage() {
  usePageMeta('Branches', 'Find Meghnad Diagnostic Centre branches: address, opening hours, phone, map and directions. Main branch at Nagdev Tower, Pune Nashik Road, Bhosari.')
  const { data, status, error, reload } = usePublicResource('branches')
  return (
    <>
      <PageHero eyebrow="Branches" title="Find a centre near you" intro="Addresses, hours and directions for each branch." />
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

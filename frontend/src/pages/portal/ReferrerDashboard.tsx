import { useCallback, useMemo } from 'react'
import { publicApi } from '../../api/public'
import { referralsApi } from '../../api/referrals'
import { FormAlert } from '../../components/form/FormAlert'
import { PageLoader } from '../../components/PageLoader'
import { ReferralForm } from '../../features/referrals/ReferralForm'
import { ReferralList } from '../../features/referrals/ReferralList'
import { useApiQuery } from '../../hooks/useApi'

export default function ReferrerDashboard() {
  const loadReferrals = useCallback(() => referralsApi.list(), [])
  const loadScans = useCallback(() => publicApi.scanTypes(), [])
  const referrals = useApiQuery(loadReferrals, [loadReferrals])
  const scans = useApiQuery(loadScans, [loadScans])

  const scanOptions = useMemo(
    () => (scans.data?.scan_types ?? []).map((scan) => ({ value: scan.id, label: `${scan.name} (${scan.modality})` })),
    [scans.data],
  )

  return (
    <section aria-labelledby="referrer-title">
      <h1 id="referrer-title">Referrer dashboard</h1>
      <p>Send a patient to the centre, follow the status and download the report once it is ready.</p>

      <div className="card">
        <h2>New referral</h2>
        {scans.error !== null ? <FormAlert>{scans.error.message}</FormAlert> : null}
        <ReferralForm scanOptions={scanOptions} onCreated={() => void referrals.reload()} />
      </div>

      <h2>Your referrals</h2>
      {referrals.error !== null ? (
        <FormAlert>
          {referrals.error.message}{' '}
          <button type="button" className="link-button" onClick={() => void referrals.reload()}>
            Try again
          </button>
        </FormAlert>
      ) : null}
      {referrals.loading && referrals.data === null ? <PageLoader /> : null}
      {referrals.data !== null ? <ReferralList referrals={referrals.data.referrals} /> : null}
    </section>
  )
}

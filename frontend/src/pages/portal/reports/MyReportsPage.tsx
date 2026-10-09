import { useCallback } from 'react'
import { reportsApi } from '../../../api/reports'
import { FormAlert } from '../../../components/form/FormAlert'
import { PageLoader } from '../../../components/PageLoader'
import { ReportList } from '../../../features/reports/ReportList'
import { useApiQuery } from '../../../hooks/useApi'

export default function MyReportsPage() {
  const load = useCallback(() => reportsApi.list(), [])
  const { data, error, loading, reload } = useApiQuery(load, [load])

  return (
    <section aria-labelledby="my-reports-title">
      <h1 id="my-reports-title">My reports</h1>
      <p>Reports appear here once the radiologist has finalised them. They are stored encrypted and every download is logged.</p>
      {error !== null ? (
        <FormAlert>
          {error.message}{' '}
          <button type="button" className="link-button" onClick={() => void reload()}>
            Try again
          </button>
        </FormAlert>
      ) : null}
      {loading && data === null ? <PageLoader /> : null}
      {data !== null ? <ReportList reports={data.reports} /> : null}
    </section>
  )
}

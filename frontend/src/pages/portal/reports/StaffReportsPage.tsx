import { useCallback, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { reportsApi } from '../../../api/reports'
import { FormAlert } from '../../../components/form/FormAlert'
import { TextField } from '../../../components/form/TextField'
import { PageLoader } from '../../../components/PageLoader'
import { ReportList } from '../../../features/reports/ReportList'
import { useApiQuery } from '../../../hooks/useApi'
import { compose, rules } from '../../../lib/validation'

const searchRule = compose(rules.safe(), rules.maxLength(80))

export default function StaffReportsPage() {
  const location = useLocation()
  const base = location.pathname.replace(/\/reports\/?$/, '')
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const searchError = searchRule(draft, {})
  const load = useCallback(() => reportsApi.list(query === '' ? {} : { q: query }), [query])
  const { data, error, loading } = useApiQuery(load, [load])

  return (
    <section aria-labelledby="staff-reports-title">
      <h1 id="staff-reports-title">Reports</h1>
      <p>
        <Link className="btn btn--primary" to={`${base}/reports/new`}>
          Upload a report
        </Link>
      </p>
      <form
        className="toolbar"
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          if (searchError === null) {
            setQuery(draft.trim())
          }
        }}
      >
        <TextField
          label="Search by title, patient or reference"
          name="q"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          error={searchError ?? undefined}
          maxLength={80}
        />
        <button type="submit" className="btn btn--outline" disabled={searchError !== null}>
          Search
        </button>
      </form>
      {error !== null ? <FormAlert>{error.message}</FormAlert> : null}
      {loading && data === null ? <PageLoader /> : null}
      {data !== null ? <ReportList reports={data.reports} showPatient /> : null}
    </section>
  )
}

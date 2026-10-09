import { useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { reportsApi } from '../../../api/reports'
import { FormAlert } from '../../../components/form/FormAlert'
import { PageLoader } from '../../../components/PageLoader'
import { UploadReportForm } from '../../../features/reports/UploadReportForm'
import { useApiQuery } from '../../../hooks/useApi'

export default function UploadReportPage() {
  const location = useLocation()
  const base = location.pathname.replace(/\/reports\/new\/?$/, '')
  const load = useCallback(() => reportsApi.staffAppointments(), [])
  const { data, error, loading } = useApiQuery(load, [load])

  return (
    <section aria-labelledby="upload-report-title">
      <p>
        <Link to={`${base}/reports`}>Back to reports</Link>
      </p>
      <h1 id="upload-report-title">Upload report</h1>
      <p>Files are encrypted on the server before they are stored. Allowed types: PDF, JPG, PNG.</p>
      {error !== null ? <FormAlert>{error.message}</FormAlert> : null}
      {loading && data === null ? <PageLoader /> : null}
      {data !== null ? <UploadReportForm appointments={data.appointments} /> : null}
    </section>
  )
}

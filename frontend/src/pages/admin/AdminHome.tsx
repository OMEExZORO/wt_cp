import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '../../api/admin'
import { BarChart } from '../../components/admin/BarChart'
import { DataTable } from '../../components/admin/DataTable'
import { PageLoader } from '../../components/PageLoader'
import { useApiQuery } from '../../hooks/useApi'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No show',
}

export default function AdminHome() {
  const { data, error, loading, reload } = useApiQuery(() => adminApi.stats(), [])
  const branchRows = useMemo(() => data?.per_day_per_branch ?? [], [data])

  return (
    <section aria-labelledby="admin-home-heading">
      <h1 id="admin-home-heading">Admin dashboard</h1>
      {error !== null ? (
        <div className="alert alert--error" role="alert">
          <p>{error.message}</p>
          <button type="button" className="btn btn--outline btn--sm" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      ) : null}
      {loading && data === null ? <PageLoader label="Loading statistics…" /> : null}
      {data !== null ? (
        <>
          <p className="muted">
            Appointments by visit date, {data.window.from} to {data.window.to}. Cancelled bookings are not counted in the chart.
          </p>
          <div className="stat-grid">
            <div className="stat">
              <span className="stat__value">{data.appointments_in_window}</span>
              <span className="stat__label">Appointments in the last {data.window.days} days</span>
            </div>
            <div className="stat">
              <span className="stat__value">{data.pending_reviews}</span>
              <span className="stat__label">
                <Link to="/portal/admin/reviews">Reviews waiting for moderation</Link>
              </span>
            </div>
          </div>

          <div className="card">
            <h2>Appointments per day</h2>
            <BarChart
              data={data.daily_totals.map((row) => ({ label: row.date, value: row.total }))}
              ariaLabel={`Bar chart of appointments per day over the last ${data.window.days} days`}
            />
            <details className="chart-table">
              <summary>View per day and branch as a table</summary>
              <DataTable
                caption="Appointments per day and branch"
                columns={[
                  { key: 'date', header: 'Date' },
                  { key: 'branch_name', header: 'Branch' },
                  { key: 'total', header: 'Appointments' },
                ]}
                rows={branchRows}
                rowKey={(row) => `${row.date}-${row.branch_id}`}
                emptyMessage="No appointments in this period."
              />
            </details>
          </div>

          <div className="two-up">
            <div className="card">
              <h2>By status</h2>
              <DataTable
                caption="Appointments by status"
                columns={[
                  { key: 'status', header: 'Status', render: (row) => STATUS_LABEL[row.status] ?? row.status },
                  { key: 'total', header: 'Appointments' },
                ]}
                rows={data.by_status}
                rowKey={(row) => row.status}
                emptyMessage="No appointments in this period."
              />
            </div>
            <div className="card">
              <h2>By modality</h2>
              <DataTable
                caption="Appointments by modality"
                columns={[
                  { key: 'modality', header: 'Modality' },
                  { key: 'total', header: 'Appointments' },
                ]}
                rows={data.by_modality}
                rowKey={(row) => row.modality}
                emptyMessage="No appointments in this period."
              />
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}

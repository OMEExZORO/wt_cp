import { api } from '../../api/client.js';
import { Alert, EmptyState, Spinner, StatusBadge, formatDate, useAsync } from '../../components/ui.jsx';
import StubNotice from './StubNotice.jsx';

export default function CriticalAlerts() {
  const { data, loading, error } = useAsync(() => api.get('/clinical/alerts'), []);

  return (
    <div>
      <h1>Critical finding alerts</h1>
      <StubNotice>
        Alerts will notify the referring doctor of critical findings, require acknowledgement, and escalate automatically
        (dashboard → SMS → phone call) if not acknowledged in time. Acknowledge and escalate actions are not active yet.
      </StubNotice>
      <Alert type="error">{error}</Alert>
      {loading && <Spinner />}
      {!loading && data?.length === 0 && <EmptyState title="No alerts raised" />}
      {!loading && data?.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Raised</th>
                <th>Patient</th>
                <th>Finding</th>
                <th>Severity</th>
                <th>Notify</th>
                <th>Escalation</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id}>
                  <td>{formatDate(a.created_at)}</td>
                  <td>{a.patient_name}</td>
                  <td>{a.finding}</td>
                  <td>
                    <span className={`badge badge-sev-${a.severity}`}>{a.severity}</span>
                  </td>
                  <td>{a.notify_name || '—'}</td>
                  <td>Level {a.escalation_level}</td>
                  <td>
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="actions">
                    <button type="button" className="btn btn-sm" disabled title="Coming soon">
                      Acknowledge
                    </button>
                    <button type="button" className="btn btn-sm btn-outline" disabled title="Coming soon">
                      Escalate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

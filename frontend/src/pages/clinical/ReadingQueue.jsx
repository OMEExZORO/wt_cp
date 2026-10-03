import { api } from '../../api/client.js';
import { Alert, EmptyState, Spinner, formatDate, formatTime, useAsync } from '../../components/ui.jsx';
import StubNotice from './StubNotice.jsx';

export default function ReadingQueue() {
  const { data, loading, error } = useAsync(() => api.get('/clinical/reading-queue'), []);

  return (
    <div>
      <h1>Priority reading queue</h1>
      <StubNotice>
        Completed scans awaiting reporting, ordered STAT → Urgent → Routine. Automatic queueing, assignment and
        turnaround-time tracking will be added later.
      </StubNotice>
      <Alert type="error">{error}</Alert>
      {loading && <Spinner />}
      {!loading && data?.length === 0 && <EmptyState title="Queue is empty" />}
      {!loading && data?.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Patient</th>
                <th>Scan</th>
                <th>Branch</th>
                <th>Scan date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((q) => (
                <tr key={q.id}>
                  <td>
                    <span className={`badge badge-prio-${q.priority}`}>{q.priority}</span>
                  </td>
                  <td>{q.patient_name}</td>
                  <td>{q.scan_type_name}</td>
                  <td>{q.branch_name}</td>
                  <td>
                    {formatDate(q.appointment_date)} {formatTime(q.start_time)}
                  </td>
                  <td>{q.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

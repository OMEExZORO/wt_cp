import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Alert, EmptyState, Spinner, StatusBadge, formatDate, formatTime, todayISO, useAsync } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Overview() {
  const { user } = useAuth();
  const isStaff = user.role === 'doctor' || user.role === 'receptionist';
  const { data, loading, error } = useAsync(
    () => api.get('/appointments', isStaff ? { date: todayISO() } : { scope: 'upcoming' }),
    [isStaff]
  );
  const active = (data || []).filter((a) => !['cancelled', 'no_show'].includes(a.status));

  return (
    <div>
      <h1>Welcome, {user.full_name}</h1>
      <Alert type="error">{error}</Alert>
      <div className="stat-grid">
        <div className="stat">
          <span className="stat-value">{loading ? '…' : active.length}</span>
          <span className="stat-label">{isStaff ? "Today's appointments" : 'Upcoming appointments'}</span>
        </div>
        {user.role !== 'referring_doctor' && (
          <Link to="/dashboard/book" className="stat stat-action">
            <span className="stat-value">+</span>
            <span className="stat-label">Book an appointment</span>
          </Link>
        )}
        {user.role !== 'receptionist' && (
          <Link to="/dashboard/reports" className="stat stat-action">
            <span className="stat-value">↓</span>
            <span className="stat-label">{user.role === 'doctor' ? 'Upload / view reports' : 'View reports'}</span>
          </Link>
        )}
      </div>

      <section className="panel">
        <div className="section-head">
          <h2>{isStaff ? "Today's schedule" : 'Upcoming'}</h2>
          <Link to="/dashboard/appointments">See all →</Link>
        </div>
        {loading && <Spinner />}
        {!loading && active.length === 0 && <EmptyState title="Nothing scheduled">No active appointments to show.</EmptyState>}
        <ul className="appt-list">
          {active.slice(0, 8).map((a) => (
            <li key={a.id}>
              <div>
                <strong>{a.scan_type_name}</strong>
                <span className="muted">
                  {formatDate(a.appointment_date)} • {formatTime(a.start_time)} • {a.branch_name}
                </span>
                {user.role !== 'patient' && <span>Patient: {a.patient_name}</span>}
              </div>
              <StatusBadge status={a.status} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

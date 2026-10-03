import { useState } from 'react';
import { api } from '../../api/client.js';
import { Alert, EmptyState, Spinner, StatusBadge, formatDate, formatTime, useAsync } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const STATUSES = ['booked', 'confirmed', 'completed', 'cancelled', 'no_show'];

export default function Appointments() {
  const { user } = useAuth();
  const isStaff = user.role === 'doctor' || user.role === 'receptionist';
  const [filters, setFilters] = useState({ scope: isStaff ? 'all' : 'upcoming', date: '', branch_id: '', status: '' });
  const [message, setMessage] = useState({ type: '', text: '' });
  const { data: branches } = useAsync(() => api.get('/branches'), []);
  const { data, loading, error, reload } = useAsync(() => api.get('/appointments', filters), [JSON.stringify(filters)]);

  const setFilter = (e) => setFilters((f) => ({ ...f, [e.target.name]: e.target.value }));

  const updateStatus = async (appt, status) => {
    if (status === 'cancelled' && !window.confirm('Cancel this appointment?')) return;
    try {
      const res = await api.patch(`/appointments/${appt.id}/status`, { status });
      setMessage({ type: 'success', text: res.message });
      reload();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const canCancel = (a) => ['booked', 'confirmed'].includes(a.status) && new Date(`${a.appointment_date}T${a.start_time}`) - Date.now() > 2 * 3600 * 1000;

  return (
    <div>
      <h1>{user.role === 'referring_doctor' ? 'Referred appointments' : user.role === 'patient' ? 'My appointments' : 'Appointments'}</h1>
      <Alert type={message.type} onClose={() => setMessage({ type: '', text: '' })}>
        {message.text}
      </Alert>
      <Alert type="error">{error}</Alert>
      <div className="filters">
        <select name="scope" value={filters.scope} onChange={setFilter} aria-label="Period">
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
          <option value="all">All</option>
        </select>
        <input type="date" name="date" value={filters.date} onChange={setFilter} aria-label="Date" />
        <select name="branch_id" value={filters.branch_id} onChange={setFilter} aria-label="Branch">
          <option value="">All branches</option>
          {(branches || []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select name="status" value={filters.status} onChange={setFilter} aria-label="Status">
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>
      {loading && <Spinner />}
      {!loading && data?.length === 0 && <EmptyState title="No appointments found">Try changing the filters.</EmptyState>}
      {!loading && data?.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date & time</th>
                {user.role !== 'patient' && <th>Patient</th>}
                <th>Scan</th>
                <th>Branch</th>
                <th>Referred by</th>
                <th>Status</th>
                {user.role !== 'referring_doctor' && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id}>
                  <td>
                    {formatDate(a.appointment_date)}
                    <br />
                    <small className="muted">
                      {formatTime(a.start_time)} – {formatTime(a.end_time)}
                    </small>
                  </td>
                  {user.role !== 'patient' && (
                    <td>
                      {a.patient_name}
                      {isStaff && (
                        <>
                          <br />
                          <small className="muted">{a.patient_phone}</small>
                        </>
                      )}
                    </td>
                  )}
                  <td>{a.scan_type_name}</td>
                  <td>{a.branch_name}</td>
                  <td>{a.referring_doctor_name || '—'}</td>
                  <td>
                    <StatusBadge status={a.status} />
                  </td>
                  {user.role === 'patient' && (
                    <td>
                      {canCancel(a) ? (
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => updateStatus(a, 'cancelled')}>
                          Cancel
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  )}
                  {isStaff && (
                    <td>
                      <select
                        value={a.status}
                        onChange={(e) => updateStatus(a, e.target.value)}
                        disabled={['cancelled', 'no_show'].includes(a.status)}
                        aria-label="Change status"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

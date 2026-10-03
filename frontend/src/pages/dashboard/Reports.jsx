import { useState } from 'react';
import { api } from '../../api/client.js';
import { Alert, EmptyState, Field, Spinner, formatBytes, formatDate, useAsync } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import PatientPicker from './PatientPicker.jsx';

const MAX_BYTES = 10 * 1024 * 1024;

export default function Reports() {
  const { user } = useAuth();
  const isDoctor = user.role === 'doctor';
  const [message, setMessage] = useState({ type: '', text: '' });
  const { data, loading, error, reload } = useAsync(() => api.get('/reports'), []);

  const download = async (r) => {
    try {
      await api.download(`/reports/${r.id}/download`);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const remove = async (r) => {
    if (!window.confirm(`Delete report "${r.title}" permanently?`)) return;
    try {
      const res = await api.del(`/reports/${r.id}`);
      setMessage({ type: 'success', text: res.message });
      reload();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div>
      <h1>{user.role === 'patient' ? 'My reports' : user.role === 'referring_doctor' ? 'Reports of referred patients' : 'Reports'}</h1>
      <Alert type={message.type} onClose={() => setMessage({ type: '', text: '' })}>
        {message.text}
      </Alert>
      {isDoctor && <UploadForm onUploaded={(text) => (setMessage({ type: 'success', text }), reload())} />}
      <Alert type="error">{error}</Alert>
      {loading && <Spinner />}
      {!loading && data?.length === 0 && (
        <EmptyState title="No reports yet">Reports appear here as soon as the radiologist uploads them.</EmptyState>
      )}
      {!loading && data?.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Report</th>
                {user.role !== 'patient' && <th>Patient</th>}
                <th>Scan date</th>
                <th>Uploaded</th>
                <th>File</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.title}</strong>
                    {r.scan_type_name && (
                      <>
                        <br />
                        <small className="muted">{r.scan_type_name}</small>
                      </>
                    )}
                  </td>
                  {user.role !== 'patient' && <td>{r.patient_name}</td>}
                  <td>{r.appointment_date ? formatDate(r.appointment_date) : '—'}</td>
                  <td>{formatDate(r.created_at)}</td>
                  <td>
                    {r.mime_type === 'application/pdf' ? 'PDF' : 'JPG'} • {formatBytes(r.size_bytes)}
                  </td>
                  <td className="actions">
                    <button type="button" className="btn btn-sm" onClick={() => download(r)}>
                      Download
                    </button>
                    {isDoctor && (
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(r)}>
                        Delete
                      </button>
                    )}
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

function UploadForm({ onUploaded }) {
  const [patient, setPatient] = useState(null);
  const [appointmentId, setAppointmentId] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const { data: appointments } = useAsync(
    () => (patient ? api.get('/appointments', { patient_id: patient.id, scope: 'all' }) : Promise.resolve([])),
    [patient?.id]
  );

  const onFile = (e) => {
    const f = e.target.files?.[0] || null;
    setErrors((er) => ({ ...er, file: undefined }));
    if (f && !['application/pdf', 'image/jpeg'].includes(f.type)) {
      setErrors((er) => ({ ...er, file: 'Only PDF or JPG files are allowed.' }));
    } else if (f && f.size > MAX_BYTES) {
      setErrors((er) => ({ ...er, file: 'File must be 10 MB or smaller.' }));
    }
    setFile(f);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const er = {};
    if (!patient) er.patient_id = 'Select a patient.';
    if (title.trim().length < 3) er.title = 'Enter a report title (min 3 characters).';
    if (!file) er.file = 'Choose a PDF or JPG file.';
    if (Object.keys(er).length || errors.file) {
      setErrors({ ...errors, ...er });
      return;
    }
    const form = new FormData();
    form.append('patient_id', patient.id);
    if (appointmentId) form.append('appointment_id', appointmentId);
    form.append('title', title.trim());
    form.append('file', file);
    setBusy(true);
    setError('');
    try {
      const res = await api.upload('/reports', form);
      setTitle('');
      setFile(null);
      setAppointmentId('');
      setInputKey((k) => k + 1);
      onUploaded(res.message);
    } catch (err) {
      setErrors(err.errors || {});
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="panel form" onSubmit={onSubmit} noValidate>
      <h2>Upload a report</h2>
      <Alert type="error">{error}</Alert>
      <div className="row-2">
        <Field label="Patient" name="patient_id" error={errors.patient_id} required>
          <PatientPicker value={patient} onChange={(p) => (setPatient(p), setAppointmentId(''))} />
        </Field>
        <Field label="Linked appointment" name="appointment_id" error={errors.appointment_id} hint="Optional">
          <select id="appointment_id" value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)} disabled={!patient}>
            <option value="">Not linked</option>
            {(appointments || []).map((a) => (
              <option key={a.id} value={a.id}>
                {formatDate(a.appointment_date)} — {a.scan_type_name} ({a.branch_name})
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="row-2">
        <Field label="Report title" name="title" error={errors.title} required>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} placeholder="e.g. USG Whole Abdomen" />
        </Field>
        <Field label="File (PDF or JPG, max 10 MB)" name="file" error={errors.file} required>
          <input key={inputKey} id="file" type="file" accept="application/pdf,image/jpeg,.pdf,.jpg,.jpeg" onChange={onFile} />
        </Field>
      </div>
      <button className="btn" disabled={busy}>
        {busy ? 'Encrypting & uploading…' : 'Upload report'}
      </button>
    </form>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Alert, Field, Spinner, formatDate, formatTime, todayISO, useAsync } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { categories } from '../../config/site.js';
import PatientPicker from './PatientPicker.jsx';

export default function BookAppointment() {
  const { user } = useAuth();
  const location = useLocation();
  const isStaff = user.role !== 'patient';
  const { data: branches } = useAsync(() => api.get('/branches'), []);
  const { data: scanTypes } = useAsync(() => api.get('/scan-types'), []);
  const { data: referrers } = useAsync(() => api.get('/referring-doctors'), []);

  const [patient, setPatient] = useState(null);
  const [branchId, setBranchId] = useState(location.state?.branchId ? String(location.state.branchId) : '');
  const [scanTypeId, setScanTypeId] = useState('');
  const [date, setDate] = useState(todayISO(1));
  const [slotId, setSlotId] = useState(null);
  const [referrerId, setReferrerId] = useState('');
  const [notes, setNotes] = useState('');
  const [availability, setAvailability] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState({ type: '', text: '' });
  const [conflict, setConflict] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const pendingSlot = useRef(null);

  useEffect(() => {
    if (!branchId && branches?.length) setBranchId(String(branches[0].id));
  }, [branches, branchId]);

  useEffect(() => {
    if (!branchId || !date) return undefined;
    let active = true;
    setLoadingSlots(true);
    setSlotId(null);
    api
      .get('/appointments/availability', { branch_id: branchId, date })
      .then((data) => {
        if (!active) return;
        setAvailability(data);
        setErrors({});
        const wanted = pendingSlot.current;
        pendingSlot.current = null;
        if (wanted && data.slots.some((s) => s.slot_id === wanted && s.available)) setSlotId(wanted);
      })
      .catch((err) => active && (setAvailability(null), setErrors(err.errors || {}), setMessage({ type: 'error', text: err.message })))
      .finally(() => active && setLoadingSlots(false));
    return () => {
      active = false;
    };
  }, [branchId, date, reloadKey]);

  const grouped = useMemo(() => {
    const out = {};
    (scanTypes || []).forEach((s) => {
      (out[s.category] ||= []).push(s);
    });
    return out;
  }, [scanTypes]);

  const selectedScan = (scanTypes || []).find((s) => String(s.id) === String(scanTypeId));
  const selectedSlot = availability?.slots.find((s) => s.slot_id === slotId);

  const jumpTo = (suggestion) => {
    setConflict(null);
    setMessage({ type: 'info', text: `Switched to ${suggestion.branch_name} on ${formatDate(suggestion.date)}. Confirm the ${formatTime(suggestion.start_time)} slot below.` });
    pendingSlot.current = suggestion.slot_id;
    setBranchId(String(suggestion.branch_id));
    setDate(suggestion.date);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const clientErrors = {};
    if (isStaff && !patient) clientErrors.patient_id = 'Select a patient.';
    if (!scanTypeId) clientErrors.scan_type_id = 'Select a scan.';
    if (!slotId) clientErrors.slot_id = 'Pick a time slot.';
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors);
      return;
    }
    setSubmitting(true);
    setErrors({});
    setConflict(null);
    setMessage({ type: '', text: '' });
    try {
      const res = await api.post('/appointments', {
        branch_id: Number(branchId),
        scan_type_id: Number(scanTypeId),
        slot_id: slotId,
        appointment_date: date,
        patient_id: isStaff ? patient.id : undefined,
        referring_doctor_id: referrerId ? Number(referrerId) : null,
        notes: notes || null,
      });
      setBooked(res.data);
    } catch (err) {
      setErrors(err.errors || {});
      setMessage({ type: 'error', text: err.message });
      if (err.status === 409 && err.extra.code === 'slot_taken') {
        setConflict(err.extra);
        setReloadKey((k) => k + 1);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (booked) {
    return (
      <div className="panel confirm">
        <h1>Appointment confirmed</h1>
        <p>
          <strong>{booked.scan_type_name}</strong> for {booked.patient_name}
        </p>
        <p>
          {formatDate(booked.appointment_date)} at {formatTime(booked.start_time)} — {booked.branch_name}
        </p>
        {booked.scan_preparation && (
          <Alert type="info">
            <strong>Preparation:</strong> {booked.scan_preparation}
          </Alert>
        )}
        <p className="muted">Please arrive 10 minutes early and carry your doctor's referral slip and any previous reports.</p>
        <div className="btn-row">
          <Link to="/dashboard/appointments" className="btn">
            View my appointments
          </Link>
          <button type="button" className="btn btn-outline" onClick={() => (setBooked(null), setSlotId(null), setReloadKey((k) => k + 1))}>
            Book another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="book" onSubmit={onSubmit} noValidate>
      <h1>Book an appointment</h1>
      <Alert type={message.type} onClose={() => setMessage({ type: '', text: '' })}>
        {message.text}
      </Alert>

      {conflict && (
        <div className="suggest">
          {conflict.next_same_branch ? (
            <>
              <p>
                The next free slot at this branch is <strong>{formatTime(conflict.next_same_branch.start_time)}</strong>.
              </p>
              <button type="button" className="btn btn-sm" onClick={() => (setSlotId(conflict.next_same_branch.slot_id), setConflict(null))}>
                Select {formatTime(conflict.next_same_branch.start_time)}
              </button>
            </>
          ) : conflict.suggestion ? (
            <>
              <p>
                This branch is now full. Earliest slot at <strong>{conflict.suggestion.branch_name}</strong>:{' '}
                {formatDate(conflict.suggestion.date)}, {formatTime(conflict.suggestion.start_time)}.
              </p>
              <button type="button" className="btn btn-sm" onClick={() => jumpTo(conflict.suggestion)}>
                Switch to this slot
              </button>
            </>
          ) : null}
        </div>
      )}

      <div className="book-grid">
        <div className="panel">
          <h2>1. Details</h2>
          {isStaff && (
            <Field label="Patient" name="patient_id" error={errors.patient_id} required>
              <PatientPicker value={patient} onChange={setPatient} />
            </Field>
          )}
          <Field label="Scan type" name="scan_type_id" error={errors.scan_type_id} required>
            <select id="scan_type_id" value={scanTypeId} onChange={(e) => setScanTypeId(e.target.value)}>
              <option value="">Select a scan…</option>
              {Object.entries(grouped).map(([cat, list]) => (
                <optgroup key={cat} label={categories[cat]?.label || cat}>
                  {list.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — ₹{Number(s.price).toLocaleString('en-IN')}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
          {selectedScan?.preparation && <p className="prep">Preparation: {selectedScan.preparation}</p>}
          <Field label="Branch" name="branch_id" error={errors.branch_id} required>
            <select id="branch_id" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {(branches || []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date" name="date" error={errors.date || errors.appointment_date} required>
            <input id="date" type="date" min={todayISO()} max={todayISO(60)} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Referring doctor" name="referring_doctor_id" error={errors.referring_doctor_id} hint="Optional — lets your doctor see this booking and its report">
            <select id="referring_doctor_id" value={referrerId} onChange={(e) => setReferrerId(e.target.value)}>
              <option value="">None / self-referred</option>
              {(referrers || []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notes for the clinic" name="notes" error={errors.notes}>
            <textarea id="notes" rows={3} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>

        <div className="panel">
          <h2>2. Choose a time</h2>
          {errors.slot_id && <p className="error-text">{errors.slot_id}</p>}
          {loadingSlots && <Spinner label="Checking availability…" />}
          {!loadingSlots && availability && (
            <>
              <p className="muted">
                {availability.branch.name} • {formatDate(availability.date)}
              </p>
              <div className="slot-grid">
                {availability.slots.map((s) => (
                  <button
                    type="button"
                    key={s.slot_id}
                    className={`slot ${slotId === s.slot_id ? 'selected' : ''}`}
                    disabled={!s.available}
                    onClick={() => setSlotId(s.slot_id)}
                    aria-pressed={slotId === s.slot_id}
                  >
                    {formatTime(s.start_time)}
                  </button>
                ))}
              </div>
              {availability.branch_full && (
                <div className="suggest">
                  {availability.suggestion ? (
                    <>
                      <p>
                        {availability.branch.name} is {availability.branch_closed ? 'closed' : 'fully booked'} on this day. The earliest
                        available slot is at{' '}
                        <strong>{availability.suggestion.branch_name}</strong> on {formatDate(availability.suggestion.date)} at{' '}
                        {formatTime(availability.suggestion.start_time)}.
                      </p>
                      <button type="button" className="btn btn-sm" onClick={() => jumpTo(availability.suggestion)}>
                        Book at {availability.suggestion.branch_name}
                      </button>
                    </>
                  ) : (
                    <p>No free slots found at other branches in the next 30 days. Please call the clinic.</p>
                  )}
                </div>
              )}
            </>
          )}
          <div className="book-summary">
            {selectedSlot ? (
              <p>
                Selected: <strong>{formatTime(selectedSlot.start_time)}</strong> on {formatDate(date)}
              </p>
            ) : (
              <p className="muted">No slot selected yet.</p>
            )}
            <button className="btn btn-block" disabled={submitting}>
              {submitting ? 'Booking…' : 'Confirm booking'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

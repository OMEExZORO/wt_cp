import { useState } from 'react';
import { api } from '../../api/client.js';
import { Alert, Field, formatTime, useAsync } from '../../components/ui.jsx';
import CrudPage, { activeColumn } from './CrudPage.jsx';
import { dayNames } from '../../config/site.js';

const dayOptions = dayNames.map((label, value) => ({ value: String(value), label }));

export default function Slots() {
  const { data: branches } = useAsync(() => api.get('/admin/branches'), []);
  const [branchId, setBranchId] = useState('');
  const [day, setDay] = useState('');
  const [version, setVersion] = useState(0);
  const branchOptions = (branches || []).map((b) => ({ value: String(b.id), label: b.name }));

  const fields = [
    { name: 'branch_id', label: 'Branch', type: 'select', options: branchOptions, placeholder: 'Select branch', required: true },
    { name: 'day_of_week', label: 'Day', type: 'select', options: dayOptions, required: true },
    { name: 'start_time', label: 'Start time', type: 'time', required: true },
    { name: 'end_time', label: 'End time', type: 'time', required: true },
    { name: 'is_active', label: 'Availability', type: 'checkbox', checkboxLabel: 'Active (bookable)' },
  ];

  return (
    <>
      <CrudPage
        key={version}
        title="Slots"
        description="Weekly recurring time slots per branch. One booking per slot per date."
        endpoint="/admin/slots"
        query={{ branch_id: branchId, day_of_week: day }}
        fields={fields}
        initial={{ branch_id: branchId, day_of_week: '1', start_time: '', end_time: '', is_active: true }}
        toolbar={
          <div className="filters">
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} aria-label="Branch">
              <option value="">All branches</option>
              {branchOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select value={day} onChange={(e) => setDay(e.target.value)} aria-label="Day">
              <option value="">All days</option>
              {dayOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        }
        columns={[
          { key: 'branch_name', label: 'Branch' },
          { key: 'day_of_week', label: 'Day', render: (r) => dayNames[r.day_of_week] },
          { key: 'start_time', label: 'Time', render: (r) => `${formatTime(r.start_time)} – ${formatTime(r.end_time)}` },
          activeColumn,
        ]}
        toForm={(r) => ({
          ...r,
          branch_id: String(r.branch_id),
          day_of_week: String(r.day_of_week),
          start_time: r.start_time.slice(0, 5),
          end_time: r.end_time.slice(0, 5),
          is_active: Boolean(r.is_active),
        })}
        toPayload={(v) => ({ ...v, branch_id: String(v.branch_id), day_of_week: String(v.day_of_week) })}
      />
      <Generator branchOptions={branchOptions} onDone={() => setVersion((v) => v + 1)} />
    </>
  );
}

function Generator({ branchOptions, onDone }) {
  const [values, setValues] = useState({ branch_id: '', days: [1, 2, 3, 4, 5, 6], from_time: '09:00', to_time: '13:00', interval_minutes: 20 });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState({ type: '', text: '' });

  const toggleDay = (d) =>
    setValues((v) => ({ ...v, days: v.days.includes(d) ? v.days.filter((x) => x !== d) : [...v.days, d].sort() }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    try {
      const res = await api.post('/admin/slots/generate', { ...values, interval_minutes: String(values.interval_minutes) });
      setMessage({ type: 'success', text: res.message });
      onDone();
    } catch (err) {
      setErrors(err.errors || {});
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <form className="panel form" onSubmit={onSubmit} noValidate>
      <h2>Bulk-generate slots</h2>
      <Alert type={message.type}>{message.text}</Alert>
      <div className="row-2">
        <Field label="Branch" name="gen_branch" error={errors.branch_id} required>
          <select id="gen_branch" value={values.branch_id} onChange={(e) => setValues((v) => ({ ...v, branch_id: e.target.value }))}>
            <option value="">Select branch</option>
            {branchOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Interval (minutes)" name="gen_interval" error={errors.interval_minutes} required>
          <input id="gen_interval" type="number" min={5} max={240} value={values.interval_minutes} onChange={(e) => setValues((v) => ({ ...v, interval_minutes: e.target.value }))} />
        </Field>
      </div>
      <Field label="Days" name="gen_days" error={errors.days} required>
        <div className="day-picks" id="gen_days">
          {dayNames.map((d, i) => (
            <label key={d} className="checkbox">
              <input type="checkbox" checked={values.days.includes(i)} onChange={() => toggleDay(i)} />
              {d.slice(0, 3)}
            </label>
          ))}
        </div>
      </Field>
      <div className="row-2">
        <Field label="From" name="gen_from" error={errors.from_time} required>
          <input id="gen_from" type="time" value={values.from_time} onChange={(e) => setValues((v) => ({ ...v, from_time: e.target.value }))} />
        </Field>
        <Field label="To" name="gen_to" error={errors.to_time} required>
          <input id="gen_to" type="time" value={values.to_time} onChange={(e) => setValues((v) => ({ ...v, to_time: e.target.value }))} />
        </Field>
      </div>
      <button className="btn">Generate slots</button>
    </form>
  );
}

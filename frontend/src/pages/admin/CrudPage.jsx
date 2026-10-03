import { useState } from 'react';
import { api } from '../../api/client.js';
import { Alert, EmptyState, Field, Modal, Spinner, useAsync } from '../../components/ui.jsx';

function Input({ field, value, onChange, editing }) {
  const common = { id: field.name, name: field.name, onChange, required: field.required };
  switch (field.type) {
    case 'textarea':
      return <textarea {...common} rows={3} value={value ?? ''} maxLength={field.maxLength} />;
    case 'select':
      return (
        <select {...common} value={value ?? ''}>
          {field.placeholder && <option value="">{field.placeholder}</option>}
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case 'checkbox':
      return (
        <label className="checkbox">
          <input type="checkbox" {...common} checked={Boolean(value)} />
          {field.checkboxLabel || 'Active'}
        </label>
      );
    default:
      return (
        <input
          {...common}
          type={field.type || 'text'}
          value={value ?? ''}
          maxLength={field.maxLength}
          step={field.step}
          min={field.min}
          max={field.max}
          placeholder={editing && field.editPlaceholder ? field.editPlaceholder : field.placeholder}
          autoComplete={field.type === 'password' ? 'new-password' : undefined}
        />
      );
  }
}

export default function CrudPage({
  title,
  description,
  endpoint,
  listEndpoint,
  query,
  columns,
  fields,
  initial,
  toForm = (row) => row,
  toPayload = (v) => v,
  toolbar,
  deleteLabel = 'Delete',
  canDelete = () => true,
}) {
  const { data, loading, error, reload } = useAsync(() => api.get(listEndpoint || endpoint, query), [JSON.stringify(query || {})]);
  const [editing, setEditing] = useState(null);
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);

  const open = (row) => {
    setEditing(row || 'new');
    setValues(row ? { ...initial, ...toForm(row) } : initial);
    setErrors({});
    setFormError('');
  };

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setValues((v) => ({ ...v, [name]: type === 'checkbox' ? checked : value }));
    setErrors((er) => ({ ...er, [name]: undefined }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      const payload = toPayload(values, editing !== 'new');
      const res = editing === 'new' ? await api.post(endpoint, payload) : await api.put(`${endpoint}/${editing.id}`, payload);
      setMessage({ type: 'success', text: res.message });
      setEditing(null);
      reload();
    } catch (err) {
      setErrors(err.errors || {});
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (row) => {
    if (!window.confirm(`${deleteLabel} this record?`)) return;
    try {
      const res = await api.del(`${endpoint}/${row.id}`);
      setMessage({ type: 'success', text: res.message });
      reload();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div>
      <div className="section-head">
        <div>
          <h1>{title}</h1>
          {description && <p className="muted">{description}</p>}
        </div>
        <button type="button" className="btn" onClick={() => open(null)}>
          + Add new
        </button>
      </div>
      {toolbar}
      <Alert type={message.type} onClose={() => setMessage({ type: '', text: '' })}>
        {message.text}
      </Alert>
      <Alert type="error">{error}</Alert>
      {loading && <Spinner />}
      {!loading && data?.length === 0 && <EmptyState title="Nothing here yet">Use “Add new” to create the first record.</EmptyState>}
      {!loading && data?.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} className={row.is_active === 0 ? 'row-inactive' : ''}>
                  {columns.map((c) => (
                    <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>
                  ))}
                  <td className="actions">
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => open(row)}>
                      Edit
                    </button>
                    {canDelete(row) && (
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => onDelete(row)}>
                        {deleteLabel}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal title={editing === 'new' ? `Add ${title.replace(/s$/, '').toLowerCase()}` : `Edit ${title.replace(/s$/, '').toLowerCase()}`} onClose={() => setEditing(null)}>
          <form className="form" onSubmit={onSubmit} noValidate>
            <Alert type="error">{formError}</Alert>
            {fields
              .filter((f) => !(f.createOnly && editing !== 'new'))
              .map((f) => (
                <Field key={f.name} label={f.label} name={f.name} error={errors[f.name]} hint={f.hint} required={f.required && !(f.optionalOnEdit && editing !== 'new')}>
                  <Input field={f} value={values[f.name]} onChange={onChange} editing={editing !== 'new'} />
                </Field>
              ))}
            <div className="btn-row">
              <button className="btn" disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export const activeColumn = {
  key: 'is_active',
  label: 'Status',
  render: (r) => <span className={`badge ${r.is_active ? 'badge-confirmed' : 'badge-cancelled'}`}>{r.is_active ? 'active' : 'inactive'}</span>,
};

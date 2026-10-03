import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

export default function PatientPicker({ value, onChange }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (value || q.trim().length < 2) {
      setResults([]);
      return undefined;
    }
    const t = setTimeout(() => {
      api
        .get('/patients', { q: q.trim() })
        .then((rows) => {
          setResults(rows);
          setOpen(true);
        })
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, value]);

  if (value) {
    return (
      <div className="picked">
        <span>
          <strong>{value.full_name}</strong> • {value.phone} • {value.email}
        </span>
        <button type="button" className="btn btn-sm btn-outline" onClick={() => (onChange(null), setQ(''))}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="picker">
      <input
        id="patient_id"
        placeholder="Search by name, phone or email"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        maxLength={100}
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <ul className="picker-list" role="listbox">
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => (onChange(p), setOpen(false))}>
                <strong>{p.full_name}</strong>
                <span className="muted">
                  {p.phone} • {p.email}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && q.trim().length >= 2 && results.length === 0 && <small className="hint">No matching patients. Ask the patient to register first.</small>}
    </div>
  );
}

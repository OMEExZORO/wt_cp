import { useState } from 'react';
import CrudPage, { activeColumn } from './CrudPage.jsx';
import { roleLabels } from '../../config/site.js';
import { formatDate } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const roleOptions = ['receptionist', 'doctor', 'referring_doctor'].map((value) => ({ value, label: roleLabels[value] }));

const fields = [
  { name: 'full_name', label: 'Full name', required: true, maxLength: 120 },
  { name: 'email', label: 'Email (login)', type: 'email', required: true, maxLength: 190 },
  { name: 'phone', label: 'Mobile', type: 'tel', required: true, maxLength: 15 },
  { name: 'role', label: 'Role', type: 'select', options: roleOptions, required: true },
  { name: 'registration_no', label: 'Medical registration no.', maxLength: 50, hint: 'Required for doctors and referring doctors' },
  {
    name: 'password',
    label: 'Password',
    type: 'password',
    required: true,
    optionalOnEdit: true,
    maxLength: 72,
    editPlaceholder: 'Leave blank to keep current password',
    hint: 'Min 8 characters with a letter and a number',
  },
  { name: 'is_active', label: 'Access', type: 'checkbox', checkboxLabel: 'Account active (can log in)' },
];

const initial = { full_name: '', email: '', phone: '', role: 'receptionist', registration_no: '', password: '', is_active: true };

export default function Staff() {
  const { user } = useAuth();
  const [role, setRole] = useState('');
  return (
    <CrudPage
      title="Staff & Doctors"
      description="Receptionists, doctors (admins) and referring doctors. Approve pending referring doctors by activating them."
      endpoint="/admin/staff"
      query={{ role }}
      fields={fields}
      initial={initial}
      deleteLabel="Deactivate"
      canDelete={(r) => Boolean(r.is_active) && r.id !== user.id}
      toolbar={
        <div className="filters">
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role">
            <option value="">All roles</option>
            {roleOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      }
      columns={[
        { key: 'full_name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Mobile' },
        { key: 'role', label: 'Role', render: (r) => roleLabels[r.role] },
        { key: 'last_login_at', label: 'Last login', render: (r) => (r.last_login_at ? formatDate(r.last_login_at) : 'Never') },
        activeColumn,
      ]}
      toForm={(r) => ({ ...r, registration_no: r.registration_no || '', password: '', is_active: Boolean(r.is_active) })}
      toPayload={(v) => ({ ...v, registration_no: v.registration_no || null, password: v.password || null })}
    />
  );
}

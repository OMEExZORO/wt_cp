import { api } from '../../api/client.js';
import { Alert, Field, todayISO } from '../../components/ui.jsx';
import { useForm } from '../../components/useForm.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { roleLabels } from '../../config/site.js';

export default function Profile() {
  const { user, refresh } = useAuth();
  const profile = useForm({
    full_name: user.full_name,
    phone: user.phone,
    date_of_birth: user.date_of_birth || '',
    gender: user.gender || '',
  });
  const pw = useForm({ current_password: '', new_password: '', new_password_confirmation: '' });

  const saveProfile = (e) => {
    e.preventDefault();
    profile.submit(async (v) => {
      const res = await api.put('/auth/profile', { ...v, date_of_birth: v.date_of_birth || null, gender: v.gender || null });
      profile.setMessage({ type: 'success', text: res.message });
      refresh();
    });
  };

  const changePassword = (e) => {
    e.preventDefault();
    pw.submit(async (v) => {
      const res = await api.put('/auth/password', v);
      pw.setValues({ current_password: '', new_password: '', new_password_confirmation: '' });
      pw.setMessage({ type: 'success', text: res.message });
    });
  };

  return (
    <div>
      <h1>My profile</h1>
      <p className="muted">
        {user.email} • {roleLabels[user.role]}
      </p>
      <div className="book-grid">
        <form className="panel form" onSubmit={saveProfile} noValidate>
          <h2>Personal details</h2>
          <Alert type={profile.message.type}>{profile.message.text}</Alert>
          <Field label="Full name" name="full_name" error={profile.errors.full_name} required>
            <input id="full_name" name="full_name" value={profile.values.full_name} onChange={profile.onChange} maxLength={120} />
          </Field>
          <Field label="Mobile" name="phone" error={profile.errors.phone} required>
            <input id="phone" name="phone" type="tel" value={profile.values.phone} onChange={profile.onChange} maxLength={15} />
          </Field>
          <div className="row-2">
            <Field label="Date of birth" name="date_of_birth" error={profile.errors.date_of_birth}>
              <input id="date_of_birth" type="date" name="date_of_birth" max={todayISO(-1)} value={profile.values.date_of_birth} onChange={profile.onChange} />
            </Field>
            <Field label="Gender" name="gender" error={profile.errors.gender}>
              <select id="gender" name="gender" value={profile.values.gender} onChange={profile.onChange}>
                <option value="">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </Field>
          </div>
          <button className="btn" disabled={profile.submitting}>
            Save changes
          </button>
        </form>
        <form className="panel form" onSubmit={changePassword} noValidate>
          <h2>Change password</h2>
          <Alert type={pw.message.type}>{pw.message.text}</Alert>
          <Field label="Current password" name="current_password" error={pw.errors.current_password} required>
            <input id="current_password" type="password" name="current_password" autoComplete="current-password" value={pw.values.current_password} onChange={pw.onChange} maxLength={72} />
          </Field>
          <Field label="New password" name="new_password" error={pw.errors.new_password} required>
            <input id="new_password" type="password" name="new_password" autoComplete="new-password" value={pw.values.new_password} onChange={pw.onChange} maxLength={72} />
          </Field>
          <Field label="Confirm new password" name="new_password_confirmation" error={pw.errors.new_password_confirmation} required>
            <input
              id="new_password_confirmation"
              type="password"
              name="new_password_confirmation"
              autoComplete="new-password"
              value={pw.values.new_password_confirmation}
              onChange={pw.onChange}
              maxLength={72}
            />
          </Field>
          <button className="btn" disabled={pw.submitting}>
            Update password
          </button>
        </form>
      </div>
    </div>
  );
}

import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Alert, Field, todayISO } from '../../components/ui.jsx';
import { useForm } from '../../components/useForm.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const f = useForm({
    role: 'patient',
    full_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    gender: '',
    registration_no: '',
    password: '',
    password_confirmation: '',
  });

  if (user) return <Navigate to="/dashboard" replace />;

  const onSubmit = (e) => {
    e.preventDefault();
    if (f.values.password !== f.values.password_confirmation) {
      f.setErrors({ password_confirmation: 'Passwords do not match.' });
      return;
    }
    f.submit(async (v) => {
      const payload = Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val === '' ? null : val]));
      const res = await register(payload);
      if (res.data?.pending_approval) {
        navigate('/login', { state: { registered: res.message } });
      } else {
        navigate('/dashboard', { replace: true });
      }
    });
  };

  const isReferrer = f.values.role === 'referring_doctor';

  return (
    <div className="auth-page">
      <form className="card form auth-card auth-card-wide" onSubmit={onSubmit} noValidate>
        <h1>Create an account</h1>
        <Alert type="error">{f.message.text}</Alert>
        <div className="segmented" role="radiogroup" aria-label="Account type">
          {[
            ['patient', 'I am a patient'],
            ['referring_doctor', 'I am a referring doctor'],
          ].map(([value, label]) => (
            <label key={value} className={f.values.role === value ? 'active' : ''}>
              <input type="radio" name="role" value={value} checked={f.values.role === value} onChange={f.onChange} />
              {label}
            </label>
          ))}
        </div>
        {isReferrer && (
          <Alert type="info">Referring doctor accounts are activated after the clinic verifies your registration number.</Alert>
        )}
        <Field label="Full name" name="full_name" error={f.errors.full_name} required>
          <input id="full_name" name="full_name" value={f.values.full_name} onChange={f.onChange} maxLength={120} required />
        </Field>
        <div className="row-2">
          <Field label="Email" name="email" error={f.errors.email} required>
            <input id="email" type="email" name="email" autoComplete="email" value={f.values.email} onChange={f.onChange} required />
          </Field>
          <Field label="Mobile number" name="phone" error={f.errors.phone} hint="10-digit Indian mobile" required>
            <input id="phone" type="tel" name="phone" value={f.values.phone} onChange={f.onChange} maxLength={15} required />
          </Field>
        </div>
        {isReferrer ? (
          <Field label="Medical registration no." name="registration_no" error={f.errors.registration_no} required>
            <input id="registration_no" name="registration_no" value={f.values.registration_no} onChange={f.onChange} maxLength={50} />
          </Field>
        ) : (
          <div className="row-2">
            <Field label="Date of birth" name="date_of_birth" error={f.errors.date_of_birth}>
              <input id="date_of_birth" type="date" name="date_of_birth" max={todayISO(-1)} value={f.values.date_of_birth} onChange={f.onChange} />
            </Field>
            <Field label="Gender" name="gender" error={f.errors.gender}>
              <select id="gender" name="gender" value={f.values.gender} onChange={f.onChange}>
                <option value="">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </Field>
          </div>
        )}
        <div className="row-2">
          <Field label="Password" name="password" error={f.errors.password} hint="Min 8 characters with a letter and a number" required>
            <input id="password" type="password" name="password" autoComplete="new-password" value={f.values.password} onChange={f.onChange} maxLength={72} required />
          </Field>
          <Field label="Confirm password" name="password_confirmation" error={f.errors.password_confirmation} required>
            <input
              id="password_confirmation"
              type="password"
              name="password_confirmation"
              autoComplete="new-password"
              value={f.values.password_confirmation}
              onChange={f.onChange}
              maxLength={72}
              required
            />
          </Field>
        </div>
        <button className="btn btn-block" disabled={f.submitting}>
          {f.submitting ? 'Creating account…' : 'Create account'}
        </button>
        <p className="center">
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}

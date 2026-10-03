import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Field } from '../../components/ui.jsx';
import { useForm } from '../../components/useForm.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Login() {
  const { user, login, notice, setNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const f = useForm({ email: '', password: '', remember: false });

  if (user) return <Navigate to={location.state?.from || '/dashboard'} replace />;

  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      await login(v.email, v.password, v.remember);
      navigate(location.state?.from || '/dashboard', { replace: true });
    });
  };

  return (
    <div className="auth-page">
      <form className="card form auth-card" onSubmit={onSubmit} noValidate>
        <h1>Log in</h1>
        <p className="muted">Patients, clinic staff and referring doctors sign in here.</p>
        <Alert type="info" onClose={() => setNotice('')}>
          {notice}
        </Alert>
        {location.state?.registered && <Alert type="success">{location.state.registered}</Alert>}
        <Alert type="error">{f.message.text}</Alert>
        <Field label="Email" name="email" error={f.errors.email} required>
          <input id="email" type="email" name="email" autoComplete="username" value={f.values.email} onChange={f.onChange} required />
        </Field>
        <Field label="Password" name="password" error={f.errors.password} required>
          <input
            id="password"
            type="password"
            name="password"
            autoComplete="current-password"
            value={f.values.password}
            onChange={f.onChange}
            maxLength={72}
            required
          />
        </Field>
        <label className="checkbox">
          <input type="checkbox" name="remember" checked={f.values.remember} onChange={f.onChange} />
          Remember me on this device for 30 days
        </label>
        <button className="btn btn-block" disabled={f.submitting}>
          {f.submitting ? 'Signing in…' : 'Log in'}
        </button>
        <p className="center">
          New patient? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </div>
  );
}

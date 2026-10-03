import { api } from '../../api/client.js';
import { Alert, Field, useAsync } from '../../components/ui.jsx';
import { useForm } from '../../components/useForm.js';
import { site } from '../../config/site.js';

const initial = { name: '', email: '', phone: '', branch_id: '', message: '', website: '' };

export default function Contact() {
  const { data: branches } = useAsync(() => api.get('/branches'), []);
  const f = useForm(initial);

  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      const res = await api.post('/contact', { ...v, branch_id: v.branch_id || null, phone: v.phone || null });
      f.setValues(initial);
      f.setMessage({ type: 'success', text: res.message });
    });
  };

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <h1>Contact Us</h1>
          <p>Questions about a scan, preparation or reports? We are happy to help.</p>
        </div>
      </section>
      <div className="container section split split-top">
        <div>
          <h2>Get in touch</h2>
          <p>
            Phone: <a href={`tel:${site.phone}`}>{site.phone}</a>
            <br />
            Email: <a href={`mailto:${site.email}`}>{site.email}</a>
          </p>
          {(branches || []).map((b) => (
            <div key={b.id} className="card card-plain">
              <h3>{b.name}</h3>
              <p>
                {b.address_line}, {b.city} {b.pincode}
              </p>
              <a href={`tel:${b.phone}`}>{b.phone}</a>
            </div>
          ))}
          <Alert type="warning">For medical emergencies please visit the nearest hospital emergency department.</Alert>
        </div>
        <form className="card form" onSubmit={onSubmit} noValidate>
          <h2>Send a message</h2>
          <Alert type={f.message.type}>{f.message.text}</Alert>
          <Field label="Your name" name="name" error={f.errors.name} required>
            <input id="name" name="name" value={f.values.name} onChange={f.onChange} maxLength={120} required />
          </Field>
          <div className="row-2">
            <Field label="Email" name="email" error={f.errors.email} required>
              <input id="email" type="email" name="email" value={f.values.email} onChange={f.onChange} maxLength={190} required />
            </Field>
            <Field label="Mobile" name="phone" error={f.errors.phone}>
              <input id="phone" type="tel" name="phone" value={f.values.phone} onChange={f.onChange} maxLength={15} />
            </Field>
          </div>
          <Field label="Branch" name="branch_id" error={f.errors.branch_id}>
            <select id="branch_id" name="branch_id" value={f.values.branch_id} onChange={f.onChange}>
              <option value="">Any branch</option>
              {(branches || []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Message" name="message" error={f.errors.message} required>
            <textarea id="message" name="message" rows={5} value={f.values.message} onChange={f.onChange} maxLength={2000} required />
          </Field>
          <input type="text" name="website" value={f.values.website} onChange={f.onChange} className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <button className="btn" disabled={f.submitting}>
            {f.submitting ? 'Sending…' : 'Send message'}
          </button>
        </form>
      </div>
    </>
  );
}

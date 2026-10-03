import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Alert, Spinner, useAsync } from '../../components/ui.jsx';
import { categories } from '../../config/site.js';

const intro = {
  xray: 'Low-dose digital radiography with instant image processing for bones, chest and joints.',
  sonography: 'Real-time, radiation-free ultrasound imaging of abdominal, pelvic and obstetric organs.',
  colour_doppler: 'Colour-coded blood-flow imaging to assess arteries, veins and pregnancy circulation.',
};

export default function Services() {
  const { data, loading, error } = useAsync(() => api.get('/scan-types'), []);

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <h1>Services</h1>
          <p>Digital X-ray, Sonography and Colour Doppler — all under one roof.</p>
        </div>
      </section>
      <div className="container section">
        {loading && <Spinner />}
        <Alert type="error">{error}</Alert>
        {Object.entries(categories).map(([key, cat]) => {
          const scans = (data || []).filter((s) => s.category === key);
          return (
            <section key={key} id={key} className="service-block">
              <div className="split">
                <img src={cat.image} alt={cat.label} className="rounded-img" loading="lazy" />
                <div>
                  <h2>{cat.label}</h2>
                  <p>{intro[key]}</p>
                  <div className="scan-list">
                    {scans.map((s) => (
                      <article key={s.id} className="scan-item">
                        <div className="scan-item-head">
                          <h3>{s.name}</h3>
                          <span className="price">₹{Number(s.price).toLocaleString('en-IN')}</span>
                        </div>
                        <p>{s.description}</p>
                        {s.preparation && (
                          <p className="prep">
                            <strong>Preparation:</strong> {s.preparation}
                          </p>
                        )}
                        <small className="muted">Approx. {s.duration_minutes} minutes</small>
                      </article>
                    ))}
                    {!loading && scans.length === 0 && <p className="muted">Scan list coming soon.</p>}
                  </div>
                  <Link to="/dashboard/book" className="btn">
                    Book {cat.label}
                  </Link>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

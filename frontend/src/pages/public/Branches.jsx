import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Alert, Spinner, mapEmbedUrl, mapLinkUrl, useAsync } from '../../components/ui.jsx';
import { images } from '../../config/site.js';

export default function Branches() {
  const { data, loading, error } = useAsync(() => api.get('/branches'), []);

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <h1>Our Branches</h1>
          <p>Two locations in Bhosari, Pune with morning and evening timings.</p>
        </div>
      </section>
      <div className="container section">
        {loading && <Spinner />}
        <Alert type="error">{error}</Alert>
        {(data || []).map((b) => (
          <section key={b.id} className="branch card">
            <div className="branch-info">
              <img
                src={b.image_file ? `/images/${b.image_file}` : images.branchFallback}
                alt={`${b.name} exterior`}
                className="rounded-img"
                loading="lazy"
              />
              <div>
                <h2>{b.name}</h2>
                <dl className="details">
                  <dt>Address</dt>
                  <dd>
                    {b.address_line}, {b.city} – {b.pincode}
                  </dd>
                  <dt>Timings</dt>
                  <dd>
                    {b.timings.split('|').map((t) => (
                      <span key={t} className="block">
                        {t.trim()}
                      </span>
                    ))}
                  </dd>
                  <dt>Phone</dt>
                  <dd>
                    <a href={`tel:${b.phone}`}>{b.phone}</a>
                  </dd>
                  {b.email && (
                    <>
                      <dt>Email</dt>
                      <dd>
                        <a href={`mailto:${b.email}`}>{b.email}</a>
                      </dd>
                    </>
                  )}
                </dl>
                <div className="btn-row">
                  <Link to="/dashboard/book" state={{ branchId: b.id }} className="btn">
                    Book at this branch
                  </Link>
                  <a href={mapLinkUrl(b.map_query)} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                    Get directions
                  </a>
                </div>
              </div>
            </div>
            <iframe
              title={`Map of ${b.name}`}
              className="map"
              src={mapEmbedUrl(b.map_query)}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </section>
        ))}
      </div>
    </>
  );
}

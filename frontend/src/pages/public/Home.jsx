import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAsync } from '../../components/ui.jsx';
import { categories, images, site } from '../../config/site.js';

const highlights = [
  { title: 'Radiologist-reported', text: 'Every study is personally reviewed and reported by a qualified radiologist.' },
  { title: 'Two convenient branches', text: 'Bhosari Gaon and MIDC Bhosari, with morning and evening slots.' },
  { title: 'Online booking', text: 'Pick your branch, scan and time slot in under a minute.' },
  { title: 'Secure digital reports', text: 'Download your encrypted reports from your patient dashboard.' },
];

export default function Home() {
  const { data: branches } = useAsync(() => api.get('/branches'), []);

  return (
    <>
      <section className="hero" style={{ backgroundImage: `url(${images.hero})` }}>
        <div className="hero-overlay" />
        <div className="container hero-content">
          <p className="eyebrow">Radiology & Imaging Centre • {site.location}</p>
          <h1>{site.tagline}</h1>
          <p className="lead">
            Digital X-ray, Sonography and Colour Doppler studies performed and reported by {site.doctor.name},{' '}
            {site.doctor.qualifications.join(', ')}.
          </p>
          <div className="hero-actions">
            <Link to="/dashboard/book" className="btn btn-lg">
              Book an appointment
            </Link>
            <Link to="/services" className="btn btn-lg btn-ghost">
              Explore services
            </Link>
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="grid-4">
          {highlights.map((h) => (
            <div key={h.title} className="card card-plain">
              <h3>{h.title}</h3>
              <p>{h.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="section-head">
            <h2>Our services</h2>
            <Link to="/services">View all scans →</Link>
          </div>
          <div className="grid-3">
            {Object.entries(categories).map(([key, c]) => (
              <Link key={key} to={`/services#${key}`} className="card service-card">
                <img src={c.image} alt={c.label} loading="lazy" />
                <div className="card-body">
                  <h3>{c.label}</h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section container split">
        <img src={images.doctorPortrait} alt={site.doctor.name} className="portrait" loading="lazy" />
        <div>
          <p className="eyebrow">Meet your radiologist</p>
          <h2>{site.doctor.name}</h2>
          <p className="quals">{site.doctor.qualifications.join(' • ')}</p>
          <p>
            {site.doctor.name} leads DiagnoCare with a focus on accurate diagnosis, clear communication with
            referring clinicians and a calm, respectful experience for every patient.
          </p>
          <Link to="/about" className="btn btn-outline">
            About the doctor
          </Link>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="section-head">
            <h2>Visit us in Bhosari</h2>
            <Link to="/branches">Maps & timings →</Link>
          </div>
          <div className="grid-2">
            {(branches || []).map((b) => (
              <div key={b.id} className="card card-plain">
                <h3>{b.name}</h3>
                <p>
                  {b.address_line}, {b.city} {b.pincode}
                </p>
                <p className="muted">{b.timings}</p>
                <a href={`tel:${b.phone}`}>Call {b.phone}</a>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

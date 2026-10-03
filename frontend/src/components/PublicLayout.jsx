import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { site } from '../config/site.js';

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About Doctor' },
  { to: '/services', label: 'Services' },
  { to: '/branches', label: 'Branches' },
  { to: '/contact', label: 'Contact' },
];

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label={`${site.name} home`}>
      <span className="logo-mark" aria-hidden="true">+</span>
      <span>
        Diagno<strong>Care</strong>
      </span>
    </Link>
  );
}

export default function PublicLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <Logo />
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={open}
            aria-controls="main-nav"
            onClick={() => setOpen((o) => !o)}
          >
            Menu
          </button>
          <nav id="main-nav" className={`main-nav ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end}>
                {l.label}
              </NavLink>
            ))}
            {user ? (
              <Link to="/dashboard" className="btn btn-sm">
                My Dashboard
              </Link>
            ) : (
              <>
                <NavLink to="/login">Login</NavLink>
                <Link to="/dashboard/book" className="btn btn-sm">
                  Book a Scan
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <Logo />
          <p>
            Digital X-ray, Sonography and Colour Doppler under the supervision of {site.doctor.name} (
            {site.doctor.qualifications.join(', ')}).
          </p>
        </div>
        <div>
          <h4>Quick links</h4>
          <ul>
            {links.map((l) => (
              <li key={l.to}>
                <Link to={l.to}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Patients</h4>
          <ul>
            <li>
              <Link to="/dashboard/book">Book an appointment</Link>
            </li>
            <li>
              <Link to="/dashboard/reports">Download reports</Link>
            </li>
            <li>
              <Link to="/register">Create an account</Link>
            </li>
          </ul>
        </div>
        <div>
          <h4>Reach us</h4>
          <p>
            Two branches in {site.location}
            <br />
            Phone: <a href={`tel:${site.phone}`}>{site.phone}</a>
            <br />
            Email: <a href={`mailto:${site.email}`}>{site.email}</a>
          </p>
        </div>
      </div>
      <div className="container footer-bottom">
        <small>
          © {new Date().getFullYear()} {site.name}. Sex determination of the foetus is not done here and is
          punishable under the PCPNDT Act.
        </small>
      </div>
    </footer>
  );
}

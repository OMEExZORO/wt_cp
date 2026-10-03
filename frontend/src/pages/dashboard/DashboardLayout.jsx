import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Logo } from '../../components/PublicLayout.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { roleLabels } from '../../config/site.js';

const P = 'patient';
const R = 'receptionist';
const D = 'doctor';
const F = 'referring_doctor';

const sections = [
  {
    title: 'Main',
    items: [
      { to: '/dashboard', label: 'Overview', roles: [P, R, D, F], end: true },
      { to: '/dashboard/book', label: 'Book Appointment', roles: [P, R, D] },
      { to: '/dashboard/appointments', label: 'Appointments', roles: [P, R, D, F] },
      { to: '/dashboard/reports', label: 'Reports', roles: [P, D, F] },
    ],
  },
  {
    title: 'Clinical',
    items: [
      { to: '/dashboard/clinical/reading-queue', label: 'Reading Queue', roles: [D] },
      { to: '/dashboard/clinical/alerts', label: 'Critical Alerts', roles: [D] },
      { to: '/dashboard/clinical/checklists', label: 'Safety Checklists', roles: [R, D] },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/dashboard/admin/branches', label: 'Branches', roles: [D] },
      { to: '/dashboard/admin/scan-types', label: 'Scan Types', roles: [D] },
      { to: '/dashboard/admin/slots', label: 'Slots', roles: [D] },
      { to: '/dashboard/admin/staff', label: 'Staff & Doctors', roles: [D] },
      { to: '/dashboard/admin/messages', label: 'Messages', roles: [R, D] },
    ],
  },
  {
    title: 'Account',
    items: [{ to: '/dashboard/profile', label: 'My Profile', roles: [P, R, D, F] }],
  },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const onLogout = async () => {
    await logout('You have been logged out.');
    navigate('/login');
  };

  return (
    <div className="dash">
      <aside className={`dash-side ${open ? 'open' : ''}`}>
        <div className="dash-brand">
          <Logo />
        </div>
        <nav onClick={() => setOpen(false)}>
          {sections.map((s) => {
            const items = s.items.filter((i) => i.roles.includes(user.role));
            if (items.length === 0) return null;
            return (
              <div key={s.title} className="dash-nav-group">
                <span className="dash-nav-title">{s.title}</span>
                {items.map((i) => (
                  <NavLink key={i.to} to={i.to} end={i.end}>
                    {i.label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>
      <div className="dash-main">
        <header className="dash-top">
          <button type="button" className="menu-toggle dash-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            Menu
          </button>
          <div className="dash-user">
            <strong>{user.full_name}</strong>
            <span className="badge badge-role">{roleLabels[user.role]}</span>
          </div>
          <button type="button" className="btn btn-sm btn-outline" onClick={onLogout}>
            Log out
          </button>
        </header>
        <div className="dash-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

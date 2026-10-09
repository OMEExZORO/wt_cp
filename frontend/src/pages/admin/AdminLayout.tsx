import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { PageLoader } from '../../components/PageLoader'
import '../../styles/admin.css'

const SECTIONS: { to: string; label: string; end?: boolean }[] = [
  { to: '/portal/admin', label: 'Dashboard', end: true },
  { to: '/portal/admin/users', label: 'Users' },
  { to: '/portal/admin/branches', label: 'Branches' },
  { to: '/portal/admin/catalog', label: 'Scans and checklists' },
  { to: '/portal/admin/slots', label: 'Slots' },
  { to: '/portal/admin/settings', label: 'Site settings' },
  { to: '/portal/admin/faqs', label: 'FAQs' },
  { to: '/portal/admin/doctor', label: 'Doctor profile' },
  { to: '/portal/admin/reviews', label: 'Reviews' },
  { to: '/portal/admin/audit-log', label: 'Audit log' },
]

export default function AdminLayout() {
  return (
    <div className="admin-shell">
      <nav aria-label="Admin sections" className="admin-nav">
        <ul>
          {SECTIONS.map((section) => (
            <li key={section.to}>
              <NavLink to={section.to} end={section.end}>
                {section.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="admin-content">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  )
}

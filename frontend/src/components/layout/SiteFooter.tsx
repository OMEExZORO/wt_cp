import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { loadBranches, loadSite } from '../../features/public/publicSlice'
import { branchAddress, formatPhone, telHref } from '../../lib/contact'
import { useContactInfo } from '../../lib/useContactInfo'
import { Logo } from '../brand/Logo'
import { PhoneIcon, PinIcon } from '../icons/Icons'
import { GoogleListingNote } from '../public/GoogleListingNote'
import { Todo } from '../public/Primitives'

const SERVICES: { to: string; label: string }[] = [
  { to: '/services?type=USG', label: 'Ultrasound (USG)' },
  { to: '/services?type=CT', label: 'CT scan' },
  { to: '/services?type=BIOPSY', label: 'Image-guided biopsies' },
  { to: '/services', label: 'All scans and preparation' },
]

const QUICK_LINKS: { to: string; label: string }[] = [
  { to: '/book', label: 'Book Appointment' },
  { to: '/about', label: 'Meet the radiologist' },
  { to: '/branches', label: 'Centres and directions' },
  { to: '/reviews', label: 'Patient reviews' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
]

const LEGAL: { to: string; label: string }[] = [
  { to: '/privacy', label: 'Privacy policy' },
  { to: '/terms', label: 'Terms of use' },
  { to: '/login', label: 'Patient sign in' },
  { to: '/register', label: 'Create an account' },
]

export function SiteFooter() {
  const dispatch = useAppDispatch()
  useEffect(() => {
    void dispatch(loadSite())
    void dispatch(loadBranches())
  }, [dispatch])
  const branches = useAppSelector((state) => state.public.branches.data?.branches ?? [])
  const contact = useContactInfo()
  const centres = branches.filter((branch) => !branch.address_is_placeholder)

  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__brand">
          <Logo tone="light" />
          <p className="site-footer__tagline">Imaging for a Healthier Tomorrow</p>
          <p className="site-footer__muted">Complete Diagnostic Care Under One Roof</p>
          <ul className="site-footer__contact">
            <li>
              <PhoneIcon size={16} />
              {contact.primaryPhone ? <a href={telHref(contact.primaryPhone)}>{formatPhone(contact.primaryPhone)}</a> : <Todo label="phone" />}
            </li>
          </ul>
        </div>
        <nav aria-label="Services" className="site-footer__col">
          <h2 className="site-footer__heading">Services</h2>
          <ul>
            {SERVICES.map((item) => (
              <li key={item.to}>
                <Link to={item.to}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Quick links" className="site-footer__col">
          <h2 className="site-footer__heading">Quick links</h2>
          <ul>
            {QUICK_LINKS.map((item) => (
              <li key={item.to}>
                <Link to={item.to}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="site-footer__col">
          <h2 className="site-footer__heading">Our centres</h2>
          {centres.length === 0 ? (
            <address className="site-footer__address">Nagdev Tower, Pune Nashik Road, Bhosari, Pune 411039</address>
          ) : (
            <ul className="site-footer__centres">
              {centres.map((branch) => (
                <li key={branch.id}>
                  <strong>{branch.name}</strong>
                  <address className="site-footer__address">
                    <PinIcon size={14} /> {branchAddress(branch)}
                  </address>
                  {branch.phone ? <a href={telHref(branch.phone)}>{formatPhone(branch.phone)}</a> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <nav aria-label="Legal" className="site-footer__col">
          <h2 className="site-footer__heading">Legal and account</h2>
          <ul>
            {LEGAL.map((item) => (
              <li key={item.to}>
                <Link to={item.to}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="site-footer__legal">
        <div className="container">
          <p className="site-footer__notice">
            <strong>Prenatal sex determination is prohibited under the PCPNDT Act.</strong>
          </p>
          <p className="site-footer__disclaimer">
            This website does not provide medical advice and is not for emergencies. In an emergency, call 112 or go to the nearest hospital.
          </p>
          <GoogleListingNote className="site-footer__copy" />
          <p className="site-footer__copy">© {new Date().getFullYear()} Meghnad Diagnostic Centre, Bhosari, Pune</p>
        </div>
      </div>
    </footer>
  )
}

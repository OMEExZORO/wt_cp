import { Link } from 'react-router-dom'
import { useAppSelector } from '../../app/hooks'
import { loadBranches, loadSite, selectSetting } from '../../features/public/publicSlice'
import { useAppDispatch } from '../../app/hooks'
import { useEffect } from 'react'
import { branchAddress, settingText, telHref } from '../../lib/contact'
import { Logo } from '../brand/Logo'
import { Todo } from '../public/Primitives'

export function SiteFooter() {
  const dispatch = useAppDispatch()
  useEffect(() => {
    void dispatch(loadSite())
    void dispatch(loadBranches())
  }, [dispatch])
  const branches = useAppSelector((state) => state.public.branches.data?.branches ?? [])
  const phone = settingText(useAppSelector(selectSetting('contact.phone')))
  const email = settingText(useAppSelector(selectSetting('contact.email')))
  const logo = settingText(useAppSelector(selectSetting('clinic.logo_url')))
  const primary = branches.find((branch) => !branch.address_is_placeholder)

  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__brand">
          <Logo src={logo} tone="light" />
          <p className="site-footer__tagline">Imaging for a Healthier Tomorrow</p>
          <p className="site-footer__muted">Complete Diagnostic Care Under One Roof</p>
        </div>
        <nav aria-label="Explore" className="site-footer__col">
          <h2 className="site-footer__heading">Explore</h2>
          <ul>
            <li>
              <Link to="/services">Services</Link>
            </li>
            <li>
              <Link to="/about">About the doctor</Link>
            </li>
            <li>
              <Link to="/branches">Branches</Link>
            </li>
            <li>
              <Link to="/reviews">Reviews</Link>
            </li>
            <li>
              <Link to="/faq">FAQ</Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Patients" className="site-footer__col">
          <h2 className="site-footer__heading">Patients</h2>
          <ul>
            <li>
              <Link to="/book">Book an appointment</Link>
            </li>
            <li>
              <Link to="/login">Sign in</Link>
            </li>
            <li>
              <Link to="/register">Register</Link>
            </li>
            <li>
              <Link to="/privacy">Privacy policy</Link>
            </li>
            <li>
              <Link to="/terms">Terms of use</Link>
            </li>
          </ul>
        </nav>
        <div className="site-footer__col">
          <h2 className="site-footer__heading">Find us</h2>
          <address className="site-footer__address">
            {primary ? branchAddress(primary) : 'Nagdev Tower, Pune Nashik Road, Bhosari, Pune 411039'}
          </address>
          <p>
            {phone ? <a href={telHref(phone)}>{phone}</a> : <Todo label="phone" />}
          </p>
          <p>{email ? <a href={`mailto:${email}`}>{email}</a> : <Todo label="email" />}</p>
          <Link to="/contact">Contact details</Link>
        </div>
      </div>
      <div className="site-footer__legal">
        <div className="container">
          <p className="site-footer__notice">
            <strong>Prenatal sex determination is prohibited under the PCPNDT Act.</strong>
          </p>
          <p className="site-footer__disclaimer">
            This website does not provide medical advice and is not for emergencies. In an emergency, call 112 or go to the nearest hospital.
          </p>
          <p className="site-footer__copy">© {new Date().getFullYear()} Meghnad Diagnostic Centre, Bhosari, Pune</p>
        </div>
      </div>
    </footer>
  )
}

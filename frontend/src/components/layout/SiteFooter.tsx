export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <p className="site-footer__notice">
          <strong>Prenatal sex determination is prohibited under the PCPNDT Act.</strong>
        </p>
        <p className="site-footer__disclaimer">
          This website does not provide medical advice and is not for emergencies. In an emergency, call 112 or go to the nearest hospital.
        </p>
        <p className="site-footer__copy">© {new Date().getFullYear()} Meghnad Diagnostic Centre, Bhosari, Pune</p>
      </div>
    </footer>
  )
}

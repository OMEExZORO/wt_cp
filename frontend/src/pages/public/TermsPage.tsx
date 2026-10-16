import { PageHero } from '../../components/public/Blocks'
import { usePageMeta } from '../../lib/seo'
import { LegalContact } from './PrivacyPage'

export default function TermsPage() {
  usePageMeta('Terms of Use', 'Terms for using the Meghnad Diagnostic Centre website and patient portal, including medical and legal notices.')
  return (
    <>
      <PageHero eyebrow="Legal" title="Terms of use" intro="Please read these terms before using the website or the patient portal." />
      <section className="section section--flush">
        <div className="container container--narrow prose">
          <h2>About these terms</h2>
          <p>
            These terms apply to the website and patient portal of Meghnad Diagnostic Centre, Pune. By creating an account or booking an appointment you agree to them and to our privacy policy.
          </p>

          <h2>No medical advice</h2>
          <p>
            The information on this website is general and is not medical advice, diagnosis or treatment. Scan reports support your own doctor&apos;s decisions and are not a substitute for a
            consultation. Always follow the advice of your treating doctor and the instructions given by the centre.
          </p>

          <h2>Not for emergencies</h2>
          <p>Do not use this website or the portal in an emergency. Call 112 or go to the nearest hospital.</p>

          <h2>PCPNDT Act</h2>
          <p>Prenatal sex determination is prohibited under the PCPNDT Act. The centre does not offer it, and no request related to it will be accepted.</p>

          <h2>Your account</h2>
          <p>
            Give accurate information, keep your password private and tell us if you think your account has been misused. You are responsible for activity under your account. We may suspend
            accounts that are used unlawfully or that put others at risk.
          </p>

          <h2>Appointments</h2>
          <p>
            An online booking is a request until it is confirmed by the centre, and confirmation does not guarantee that a scan will be performed. The radiologist or staff may reschedule or decline a
            scan for clinical or safety reasons. Answer the safety checklist honestly, because it protects you. If you cannot attend, please cancel or reschedule through the website so the slot can
            be offered to someone else.
          </p>

          <h2>Reports</h2>
          <p>
            Reports are shared with you, and with the referring doctor you named, through the portal. Please keep your sign-in details private and do not share a report on someone else&apos;s
            behalf without their permission.
          </p>

          <h2>Acceptable use</h2>
          <ul>
            <li>Do not use the website for anything unlawful, or to harm, harass or deceive others.</li>
            <li>Do not try to access accounts, reports or systems that are not yours, or to disrupt or overload the service.</li>
            <li>Do not submit false patient details or book on behalf of someone without their consent.</li>
            <li>Do not copy the website content or the centre&apos;s branding for commercial use without permission.</li>
          </ul>

          <h2>Availability and liability</h2>
          <p>
            We take care to keep the website accurate and available, but we cannot promise it will always be error free or uninterrupted. To the extent permitted by law, the centre is not liable
            for indirect or consequential loss arising from use of the website, or for delays caused by events beyond our control. Nothing in these terms limits liability that cannot be limited by
            law.
          </p>

          <h2>Changes</h2>
          <p>We may update these terms. Continued use of the website after a change means you accept the updated terms.</p>

          <h2>Governing law</h2>
          <p>These terms are governed by the laws of India. Courts in Pune, Maharashtra have jurisdiction over any dispute.</p>

          <h2>Contact</h2>
          <LegalContact />
        </div>
      </section>
    </>
  )
}

import { PageHero } from '../../components/public/Blocks'
import { usePageMeta } from '../../lib/seo'
import { ReviewNotice } from './PrivacyPage'

export default function TermsPage() {
  usePageMeta('Terms of Use', 'Terms for using the Meghnad Diagnostic Centre website and patient portal, including medical and legal notices.')
  return (
    <>
      <PageHero eyebrow="Legal" title="Terms of use" intro="Please read these terms before using the website or the patient portal." />
      <section className="section section--flush">
        <div className="container container--narrow prose">
          <ReviewNotice />
          <h2>No medical advice</h2>
          <p>
            The information on this website is general and is not medical advice, diagnosis or treatment. Always follow the advice of your own doctor and the instructions given by the centre.
          </p>
          <h2>Not for emergencies</h2>
          <p>Do not use this website or the portal in an emergency. Call 112 or go to the nearest hospital.</p>
          <h2>PCPNDT Act</h2>
          <p>Prenatal sex determination is prohibited under the PCPNDT Act. The centre does not offer it, and no request related to it will be accepted.</p>
          <h2>Your account</h2>
          <p>
            Give accurate information, keep your password private and tell us if you think your account has been misused. We may suspend accounts that are used unlawfully or that put others at risk.
          </p>
          <h2>Appointments</h2>
          <p>
            Booking an appointment online does not guarantee that a scan will be performed. The radiologist or staff may reschedule or decline a scan for clinical or safety reasons. Please cancel or
            reschedule if you cannot attend.
          </p>
          <h2>Reports</h2>
          <p>Reports are shared with you, and with your referring doctor where you were referred, through the portal. Reports do not replace a consultation with your treating doctor.</p>
          <h2>Reviews</h2>
          <p>Reviews are checked before they are published. We may decline reviews that are abusive, unlawful or not about a real visit.</p>
          <h2>Liability</h2>
          <p>
            We take care to keep the website accurate and available, but we cannot promise it will always be error free or uninterrupted. The extent of the centre&apos;s liability will be confirmed in
            the legal review.
          </p>
          <h2>Governing law</h2>
          <p>These terms are governed by the laws of India. The courts that may hear disputes will be confirmed in the legal review.</p>
        </div>
      </section>
    </>
  )
}

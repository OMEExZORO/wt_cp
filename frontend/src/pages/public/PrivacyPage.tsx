import { PageHero } from '../../components/public/Blocks'
import { usePageMeta } from '../../lib/seo'

export function ReviewNotice() {
  return (
    <p className="callout callout--warn" role="note">
      <strong>Pending doctor and legal review.</strong> This text is a draft written for the project. It must be reviewed and approved by the doctor and a legal adviser before the website goes live.
    </p>
  )
}

export default function PrivacyPage() {
  usePageMeta('Privacy Policy', 'How Meghnad Diagnostic Centre collects, uses and protects your personal data, and your rights under the Digital Personal Data Protection Act, 2023.')
  return (
    <>
      <PageHero eyebrow="Legal" title="Privacy policy" intro="What we collect, why we collect it, and the choices you have." />
      <section className="section section--flush">
        <div className="container container--narrow prose">
          <ReviewNotice />
          <h2>Consent</h2>
          <p>
            We ask for your consent, in line with the Digital Personal Data Protection Act, 2023 (DPDP Act), before we store your personal data when you register or book. You can withdraw consent at any
            time by contacting the centre. Withdrawing consent may mean we can no longer provide online services to you.
          </p>
          <h2>What we collect</h2>
          <ul>
            <li>Account details: name, email address, phone number and password (stored only as a one-way hash).</li>
            <li>Appointment details: branch, scan, date and time, and your answers to the pre-scan safety checklist.</li>
            <li>Reports and clinical notes uploaded by the centre. These are stored encrypted.</li>
            <li>Technical data needed to keep the service secure, such as sign-in attempts and security logs.</li>
          </ul>
          <h2>How we use it</h2>
          <p>
            We use your data to create your account, manage your appointments, prepare for your scan, deliver your reports to you and, where you were referred, to your referring doctor, and to send
            service messages such as confirmations and reminders. We do not sell your data and we do not use it for advertising.
          </p>
          <h2>Cookies</h2>
          <p>
            We use a session cookie to keep you signed in, an optional &ldquo;remember me&rdquo; cookie if you choose it, and a cookie that remembers your light or dark display choice. We do not use
            advertising cookies.
          </p>
          <h2>Who can see your data</h2>
          <p>
            Only authorised staff who need it for your care, and your referring doctor for reports linked to your referral. Access to reports is logged.
          </p>
          <h2>How long we keep it</h2>
          <p>We keep records for as long as needed for your care and to meet legal obligations. The exact retention periods will be confirmed after review.</p>
          <h2>Your rights</h2>
          <p>
            You can ask to access, correct or erase your personal data, to withdraw consent, and to complain about how your data is handled. Contact the centre using the details on the Contact page.
            The centre&apos;s grievance contact will be published here once confirmed.
          </p>
          <h2>Not medical advice</h2>
          <p>This website does not provide medical advice and is not for emergencies. In an emergency, call 112 or go to the nearest hospital.</p>
          <h2>Changes</h2>
          <p>We may update this policy. The current consent version is shown when you register.</p>
        </div>
      </section>
    </>
  )
}

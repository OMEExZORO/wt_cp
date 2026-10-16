import { PageHero } from '../../components/public/Blocks'
import { formatPhone, telHref } from '../../lib/contact'
import { usePageMeta } from '../../lib/seo'

const BHOSARI_PHONES = ['9890094569', '8308849804']

export function LegalContact() {
  return (
    <p>
      Meghnad Diagnostic Centre, Nagdeo Towers, Pune-Nashik Road, Bhosari, Pune 411 039. Phone:{' '}
      {BHOSARI_PHONES.map((phone, index) => (
        <span key={phone}>
          {index > 0 ? ' or ' : ''}
          <a href={telHref(phone)}>{formatPhone(phone)}</a>
        </span>
      ))}
      . The centre is open Monday to Saturday, 8:00 AM to 10:00 PM.
    </p>
  )
}

export default function PrivacyPage() {
  usePageMeta('Privacy Policy', 'How Meghnad Diagnostic Centre collects, uses and protects your personal data, and your rights under the Digital Personal Data Protection Act, 2023.')
  return (
    <>
      <PageHero eyebrow="Legal" title="Privacy policy" intro="What we collect, why we collect it, who can see it and the choices you have." />
      <section className="section section--flush">
        <div className="container container--narrow prose">
          <h2>Who we are</h2>
          <p>
            This website and patient portal are run by Meghnad Diagnostic Centre, a diagnostic imaging centre led by Dr. Meghnad Padsalgikar, with branches at Bhosari, Moshi, Pimple Gurav and Moi in
            Pune. We decide why and how your personal data is used, so under the Digital Personal Data Protection Act, 2023 (DPDP Act) we are the data fiduciary.
          </p>

          <h2>What we collect and why</h2>
          <ul>
            <li>
              <strong>Account:</strong> your name, email address, phone number and password. The password is stored only as a one-way hash, so no one at the centre can read it. We use this to
              create your account and sign you in.
            </li>
            <li>
              <strong>Patient profile:</strong> date of birth, gender, address, city and emergency contact, where you or reception provide them. We use this to identify you correctly and to prepare
              your scan and report.
            </li>
            <li>
              <strong>Appointments:</strong> branch, scan, date and time, urgency, notes you add, and whether the visit was completed or cancelled. We use this to schedule and run your visit.
            </li>
            <li>
              <strong>Pre-scan checklist answers:</strong> short health-related answers, for example about allergies, pregnancy or earlier reports. Staff use these to keep the scan safe for you.
              Answers that need attention are flagged for the radiologist.
            </li>
            <li>
              <strong>Reports and clinical notes:</strong> the report file and any findings or notes the radiologist records. We keep them so you and your doctor can use them.
            </li>
            <li>
              <strong>Referrer details:</strong> if you are referred, the referring doctor&apos;s name, qualification, registration number, clinic, phone and city, and the details of your
              referral. Doctors who register as referrers give us their own details.
            </li>
            <li>
              <strong>Security records:</strong> sign-in attempts with email, IP address and browser details, an audit log of important actions, and a log of who opened or downloaded each report.
              We use these to protect accounts and to show who accessed a report.
            </li>
            <li>
              <strong>Email:</strong> we send service emails such as account verification, password reset, appointment confirmation and reminders, and urgent notices about a report to the doctor
              who referred you. We do not send marketing email.
            </li>
          </ul>

          <h2>Legal basis and consent</h2>
          <p>
            We process your data with your consent, which we ask for when you register or book, and for the limited purposes the DPDP Act allows without consent, such as meeting a legal
            obligation or responding to a medical emergency. We record the date and version of the consent you give. You can withdraw consent at any time, as described under your rights. If you
            withdraw, we may no longer be able to provide online services to you.
          </p>

          <h2>Who can see your data</h2>
          <ul>
            <li>You, in your own portal.</li>
            <li>The radiologist treating you and centre staff who need the information for your scan, booking or report.</li>
            <li>The referring doctor you named, for the reports and alerts linked to your referral.</li>
            <li>Authorities or courts, only where the law requires it.</li>
          </ul>
          <p>
            We do not sell your data, share it with advertisers, or use it for advertising. Our hosting and email providers process data for us under our instructions and only to run the service.
          </p>

          <h2>How we protect it</h2>
          <ul>
            <li>Connections to the website are encrypted with HTTPS.</li>
            <li>Report files are stored encrypted with AES-256-GCM in private storage, and clinical notes and findings are stored encrypted. Reports are never publicly linked.</li>
            <li>Every report view and download is logged with the user, time and IP address.</li>
            <li>Passwords are hashed with Argon2id. Accounts are temporarily locked after repeated failed sign-ins, and requests are rate limited.</li>
            <li>Access is role based, so staff, doctors and referrers see only what their role needs.</li>
            <li>Sessions expire after a period of inactivity and cannot be read by scripts on the page.</li>
          </ul>
          <p>No system is perfectly secure. If a breach affecting your data occurs, we will tell you and the authorities as the law requires.</p>

          <h2>How long we keep it</h2>
          <p>
            Medical records, including appointments, checklist answers and reports, are kept for at least 3 years, in line with medical-record norms. After that, on your request, we delete or
            anonymise them unless the law requires us to keep them longer. Account and security records are kept only as long as needed to run and protect the service. If you ask us to delete your
            account, we remove what we are not legally required to keep.
          </p>

          <h2>Your rights</h2>
          <p>Under the DPDP Act you can ask us to:</p>
          <ul>
            <li>show you the personal data we hold about you and how it is used;</li>
            <li>correct or update data that is wrong or incomplete;</li>
            <li>erase your data, subject to the retention rules above;</li>
            <li>withdraw your consent;</li>
            <li>name a person to act for you if you cannot act yourself, and use our grievance contact below if you are unhappy with how your data is handled.</li>
          </ul>
          <p>If we cannot resolve a complaint, you may approach the Data Protection Board of India. We may ask you to confirm your identity before acting on a request.</p>

          <h2>Cookies</h2>
          <p>We use only first-party cookies and browser storage. There are no advertising, analytics or tracking scripts on this website.</p>
          <ul>
            <li>
              <strong>Session cookie:</strong> keeps you signed in while you use the portal. It ends when you sign out, after a period of inactivity, or after a maximum session length.
            </li>
            <li>
              <strong>Remember me cookie:</strong> set only if you choose to stay signed in. It lasts up to 30 days.
            </li>
            <li>
              <strong>Display choice:</strong> a cookie that remembers your light or dark theme.
            </li>
            <li>
              <strong>Browser storage:</strong> remembers your cookie choice and that you have signed in, so the site opens on the right screen.
            </li>
          </ul>
          <p>You can review your choice at any time using Cookie choices in the page footer, and you can also clear cookies in your browser.</p>

          <h2>Children</h2>
          <p>
            Children under 18 can have scans. A parent or legal guardian must create the account, book on the child&apos;s behalf and give consent. We do not track or profile children and do not
            show them advertising.
          </p>

          <h2>Changes to this policy</h2>
          <p>We may update this policy. The date and version of the consent you gave are recorded, and we will ask for fresh consent if a change materially affects how we use your data.</p>

          <h2>Contact and grievances</h2>
          <p>For any privacy request or complaint, call or visit the Bhosari centre. Please do not send medical details by message.</p>
          <LegalContact />
        </div>
      </section>
    </>
  )
}
